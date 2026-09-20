import {
  Badge,
  Box,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Button,
  Flex,
  FormLabel,
  Grid,
  GridItem,
  Heading,
  Icon,
  IconButton,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  SimpleGrid,
  Text,
  useColorModeValue,
  useDisclosure,
} from "@chakra-ui/react";
import Card from "components/card/Card";
import Spinner from "components/spinner/Spinner";
import { useLanguage } from "i18n";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  FiChevronLeft,
  FiDownload,
  FiFile,
  FiFolder,
  FiFolderPlus,
  FiImage,
  FiPlus,
  FiTrash2,
} from "react-icons/fi";
import { deleteApi, getApi, getApiBlob, postApi } from "services/api";
import Upload from "./component/Upload";

const categories = [
  { value: "GENERAL", label: "General" },
  { value: "PROPERTIES", label: "Properties", entityType: "Property" },
  { value: "LEADS", label: "Leads", entityType: "Lead" },
  { value: "OPPORTUNITIES", label: "Opportunities", entityType: "Opportunity" },
  { value: "PARTNER_CUSTOMERS", label: "Partner Customers", entityType: "PartnerCustomer" },
  { value: "CONTACTS", label: "Contacts", entityType: "Contact" },
  { value: "INVOICES", label: "Invoices" },
  { value: "QUOTES", label: "Quotes" },
  { value: "TASKS", label: "Tasks" },
  { value: "MEETINGS", label: "Meetings" },
  { value: "CALLS", label: "Calls" },
  { value: "EMAILS", label: "Emails" },
];

const entityEndpoint = (type) => ({
  Property: "api/property",
  Lead: "api/lead",
  Opportunity: "api/opportunity",
  PartnerCustomer: "api/estate/Partner%20Customers?limit=100",
  Contact: "api/contact",
}[type]);

const optionLabel = (item, type) => {
  if (type === "Property") return item.title || item.name || item.propertyAddress;
  if (type === "Lead") return item.leadName || item.leadEmail;
  if (type === "Opportunity") return item.opportunityName;
  if (type === "PartnerCustomer") return item.companyName || item.fullName;
  return [item.firstName, item.lastName].filter(Boolean).join(" ") || item.email;
};

const categoryOf = (file) => file.category || ({
  Property: "PROPERTIES",
  Lead: "LEADS",
  Opportunity: "OPPORTUNITIES",
  PartnerCustomer: "PARTNER_CUSTOMERS",
  Contact: "CONTACTS",
}[file.entityType]) || "GENERAL";

const DocumentPage = () => {
  const { t } = useLanguage();
  const [folders, setFolders] = useState([]);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [targetFolder, setTargetFolder] = useState("");
  const [folderName, setFolderName] = useState("");
  const [files, setFiles] = useState([]);
  const [fileName, setFileName] = useState("");
  const [category, setCategory] = useState("GENERAL");
  const [entityId, setEntityId] = useState("");
  const [entityOptions, setEntityOptions] = useState([]);
  const [filterCategory, setFilterCategory] = useState("");
  const [loading, setLoading] = useState(false);
  const uploadModal = useDisclosure();
  const folderModal = useDisclosure();
  const surface = useColorModeValue("white", "navy.700");
  const subtle = useColorModeValue("gray.50", "navy.800");
  const border = useColorModeValue("gray.200", "whiteAlpha.200");

  const rootFiles = folders.filter((item) => item.isRoot).flatMap((item) => item.files || []);
  const realFolders = folders.filter((item) => !item.isRoot);
  const selectedCategory = categories.find((item) => item.value === category);
  const entityType = selectedCategory?.entityType || "";

  const fetchFolders = async () => {
    setLoading(true);
    const result = await getApi("api/document");
    if (result?.status === 200) {
      setFolders(result.data || []);
      if (currentFolder) {
        const refreshed = result.data.find((item) => item._id === currentFolder._id);
        if (refreshed) setCurrentFolder(refreshed);
      }
    } else {
      toast.error(t("Failed to fetch documents"));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchFolders();
    // The initial request should run once; later mutations refresh explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setEntityId("");
    setEntityOptions([]);
    if (!entityType) return;
    getApi(entityEndpoint(entityType)).then((result) => {
      const response = result?.data;
      const data = response?.items || response?.data || response;
      if (result?.status === 200) setEntityOptions(Array.isArray(data) ? data : []);
    });
  }, [entityType]);

  const children = useMemo(
    () => currentFolder
      ? realFolders.filter((folder) => String(folder.parentFolder || "") === String(currentFolder._id))
      : [],
    [realFolders, currentFolder],
  );
  const baseFiles = currentFolder?.files || rootFiles;
  const visibleFiles = baseFiles.filter((file) => !filterCategory || categoryOf(file) === filterCategory);
  const parentFolder = currentFolder?.parentFolder
    ? realFolders.find((item) => item._id === currentFolder.parentFolder)
    : null;

  const openUpload = () => {
    setTargetFolder(currentFolder?._id || "");
    uploadModal.onOpen();
  };

  const createFolder = async () => {
    if (!folderName.trim()) return;
    setLoading(true);
    const result = await postApi("api/document/folder", {
      folderName: folderName.trim(),
      parentFolder: currentFolder?._id || null,
    });
    setLoading(false);
    if ([200, 201].includes(result?.status)) {
      setFolderName("");
      folderModal.onClose();
      await fetchFolders();
    } else {
      toast.error(result?.data?.message || t("Failed to create folder"));
    }
  };

  const uploadFiles = async () => {
    if (!files.length) return toast.error(t("Select at least one file"));
    const body = new FormData();
    if (targetFolder) body.append("folderId", targetFolder);
    if (fileName.trim()) body.append("filename", fileName.trim());
    body.append("category", category);
    if (entityType && entityId) {
      body.append("entityType", entityType);
      body.append("entityId", entityId);
    }
    files.forEach((file) => body.append("files", file));
    setLoading(true);
    const result = await postApi("api/document/add", body);
    setLoading(false);
    if (result?.status === 200) {
      setFiles([]);
      setFileName("");
      setCategory("GENERAL");
      setEntityId("");
      uploadModal.onClose();
      await fetchFolders();
      toast.success(t("Files uploaded successfully"));
    } else {
      toast.error(result?.data?.message || t("File upload failed"));
    }
  };

  const download = async (file) => {
    const result = await getApiBlob(`api/document/download/${file._id}`);
    if (result?.status !== 200) return toast.error(t("File not found"));
    const url = URL.createObjectURL(result.data);
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = file.fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const removeFile = async (file) => {
    if (!window.confirm(`${file.fileName}: ${t("Delete this file?")}`)) return;
    const result = await deleteApi("api/document/delete/", file._id);
    if (result?.status === 200) fetchFolders();
    else toast.error(t("Failed to delete file"));
  };

  return (
    <Box width="100%" minW={0}>
      <Flex
        className="crm-page-hero crm-document-heading"
        justify="space-between"
        align={{ base: "stretch", md: "center" }}
        direction={{ base: "column", md: "row" }}
        gap={3}
        mb={5}
      >
        <Box minW={0}>
          <Heading className="crm-page-hero__title" size={{ base: "md", md: "lg" }}>{t("Document Center")}</Heading>
          <Text className="crm-page-hero__subtitle" mt={1} fontSize={{ base: "sm", md: "md" }}>
            {t("Store documents in folders or without a folder and filter them by section.")}
          </Text>
        </Box>
        <Flex gap={2} wrap="wrap">
          <Button flex={{ base: 1, sm: "initial" }} leftIcon={<FiFolderPlus />} variant="outline" onClick={folderModal.onOpen}>
            {t("New folder")}
          </Button>
          <Button flex={{ base: 1, sm: "initial" }} leftIcon={<FiPlus />} variant="brand" onClick={openUpload}>
            {t("Upload document")}
          </Button>
        </Flex>
      </Flex>

      <Grid templateColumns="repeat(12, minmax(0, 1fr))" gap={{ base: 3, lg: 4 }}>
        <GridItem colSpan={{ base: 12, lg: 3 }} minW={0}>
          <Card minH={{ base: "auto", lg: "620px" }} p={{ base: 3, md: 4 }}>
            <Text fontWeight="800" mb={3}>{t("Folders")}</Text>
            <Flex
              direction={{ base: "row", lg: "column" }}
              gap={1}
              overflowX={{ base: "auto", lg: "visible" }}
              pb={{ base: 2, lg: 0 }}
            >
              <Button
                flexShrink={0}
                variant="ghost"
                justifyContent="flex-start"
                w={{ base: "auto", lg: "100%" }}
                leftIcon={<FiFile />}
                onClick={() => setCurrentFolder(null)}
                colorScheme={!currentFolder ? "brand" : "gray"}
              >
                {t("Files without folder")}
              </Button>
              {realFolders.filter((item) => !item.parentFolder).map((folder) => (
                <Button
                  key={folder._id}
                  flexShrink={0}
                  variant={currentFolder?._id === folder._id ? "solid" : "ghost"}
                  colorScheme={currentFolder?._id === folder._id ? "brand" : "gray"}
                  justifyContent="flex-start"
                  w={{ base: "auto", lg: "100%" }}
                  leftIcon={<FiFolder />}
                  onClick={() => setCurrentFolder(folder)}
                >
                  <Text noOfLines={1}>{folder.folderName}</Text>
                </Button>
              ))}
            </Flex>
          </Card>
        </GridItem>

        <GridItem colSpan={{ base: 12, lg: 9 }} minW={0}>
          <Card minH={{ base: "420px", lg: "620px" }} p={{ base: 3, md: 5 }}>
            <Flex justify="space-between" align={{ base: "stretch", sm: "center" }} mb={5} gap={3} direction={{ base: "column", sm: "row" }}>
              <Breadcrumb separator={<FiChevronLeft />} overflowX="auto" whiteSpace="nowrap">
                <BreadcrumbItem>
                  <BreadcrumbLink onClick={() => setCurrentFolder(null)}>{t("Files without folder")}</BreadcrumbLink>
                </BreadcrumbItem>
                {parentFolder && (
                  <BreadcrumbItem>
                    <BreadcrumbLink onClick={() => setCurrentFolder(parentFolder)}>{parentFolder.folderName}</BreadcrumbLink>
                  </BreadcrumbItem>
                )}
                {currentFolder && (
                  <BreadcrumbItem isCurrentPage><BreadcrumbLink>{currentFolder.folderName}</BreadcrumbLink></BreadcrumbItem>
                )}
              </Breadcrumb>
              <Select size="sm" w={{ base: "100%", sm: "210px" }} flexShrink={0} value={filterCategory} onChange={(event) => setFilterCategory(event.target.value)}>
                <option value="">{t("All sections")}</option>
                {categories.map((item) => <option value={item.value} key={item.value}>{t(item.label)}</option>)}
              </Select>
            </Flex>

            {loading ? (
              <Flex minH="350px" align="center" justify="center"><Spinner /></Flex>
            ) : (
              <>
                {children.length > 0 && (
                  <SimpleGrid columns={{ base: 1, sm: 2, md: 3, xl: 4 }} spacing={3} mb={6}>
                    {children.map((folder) => (
                      <Box key={folder._id} p={4} bg={subtle} border="1px solid" borderColor={border} borderRadius="16px" cursor="pointer" onClick={() => setCurrentFolder(folder)}>
                        <Icon as={FiFolder} color="brand.500" boxSize={7} />
                        <Text mt={2} fontWeight="800" noOfLines={1}>{folder.folderName}</Text>
                        <Text fontSize="xs" color="gray.500">{folder.files?.length || 0} {t("Files")}</Text>
                      </Box>
                    ))}
                  </SimpleGrid>
                )}

                {visibleFiles.length === 0 && children.length === 0 ? (
                  <Flex minH="300px" px={4} textAlign="center" direction="column" align="center" justify="center" bg={subtle} borderRadius="20px">
                    <Icon as={FiFile} boxSize={12} color="gray.300" />
                    <Text fontWeight="800" mt={3}>{t("No documents are available in this section")}</Text>
                    <Button size="sm" variant="brand" mt={3} onClick={openUpload}>{t("Upload the first document")}</Button>
                  </Flex>
                ) : (
                  <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={3}>
                    {visibleFiles.map((file) => {
                      const fileCategory = categories.find((item) => item.value === categoryOf(file));
                      const isImage = file.mimeType?.startsWith("image/");
                      return (
                        <Box key={file._id} bg={surface} border="1px solid" borderColor={border} borderRadius="16px" p={4} minW={0}>
                          <Flex gap={3} minW={0}>
                            <Flex w="42px" h="42px" borderRadius="12px" bg={isImage ? "purple.50" : "blue.50"} align="center" justify="center" flexShrink={0}>
                              <Icon as={isImage ? FiImage : FiFile} color={isImage ? "purple.500" : "blue.500"} boxSize={5} />
                            </Flex>
                            <Box minW={0}>
                              <Text fontWeight="800" noOfLines={1}>{file.fileName}</Text>
                              <Text fontSize="xs" color="gray.500">{file.size ? `${Math.ceil(file.size / 1024)} KB` : t("File")}</Text>
                            </Box>
                          </Flex>
                          <Badge mt={3} colorScheme="brand" borderRadius="full">{t(fileCategory?.label || "General")}</Badge>
                          <Flex mt={4} gap={2} justify="flex-end">
                            <IconButton aria-label={t("Download")} icon={<FiDownload />} size="sm" variant="ghost" onClick={() => download(file)} />
                            <IconButton aria-label={t("Delete")} icon={<FiTrash2 />} size="sm" variant="ghost" colorScheme="red" onClick={() => removeFile(file)} />
                          </Flex>
                        </Box>
                      );
                    })}
                  </SimpleGrid>
                )}
              </>
            )}
          </Card>
        </GridItem>
      </Grid>

      <Modal isOpen={folderModal.isOpen} onClose={folderModal.onClose} isCentered>
        <ModalOverlay />
        <ModalContent mx={3}>
          <ModalHeader>{t("New folder")}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormLabel>{t("Folder name")}</FormLabel>
            <Input value={folderName} onChange={(event) => setFolderName(event.target.value)} autoFocus />
            {currentFolder && <Text fontSize="xs" color="gray.500" mt={2}>{t("This folder will be created inside")} “{currentFolder.folderName}”.</Text>}
          </ModalBody>
          <ModalFooter><Button width={{ base: "100%", sm: "auto" }} variant="brand" onClick={createFolder} isLoading={loading}>{t("Create folder")}</Button></ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={uploadModal.isOpen} onClose={uploadModal.onClose} size="3xl" isCentered scrollBehavior="inside">
        <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(5px)" />
        <ModalContent borderRadius={{ base: "16px", md: "24px" }} overflow="hidden" mx={3} maxH={{ base: "calc(100vh - 24px)", md: "calc(100vh - 64px)" }}>
          <ModalHeader bg="linear-gradient(135deg, #177DDC 0%, #0F66B8 100%)" color="white" py={{ base: 4, md: 5 }} pe={12}>
            <Flex align="center" gap={3}>
              <Flex display={{ base: "none", sm: "flex" }} w="46px" h="46px" bg="whiteAlpha.300" borderRadius="14px" align="center" justify="center" flexShrink={0}><Icon as={FiPlus} boxSize={5} /></Flex>
              <Box minW={0}>
                <Text fontSize={{ base: "lg", md: "xl" }} fontWeight="900" color="white !important">{t("Upload New Document")}</Text>
                <Text fontSize="sm" color="whiteAlpha.800 !important" fontWeight="400">{t("Choose files, storage location, and category in one step.")}</Text>
              </Box>
            </Flex>
          </ModalHeader>
          <ModalCloseButton color="white" top={5} />
          <ModalBody bg={subtle} p={{ base: 3, md: 6 }}>
            <Box bg={surface} border="1px solid" borderColor={border} borderRadius="18px" p={{ base: 3, md: 4 }} mb={4}>
              <Flex align={{ base: "start", sm: "center" }} justify="space-between" gap={2} mb={3}>
                <Box>
                  <Text fontWeight="900">{t("1. Choose files")}</Text>
                  <Text fontSize="sm" color="gray.500">{t("Maximum size for each file is 15 MB.")}</Text>
                </Box>
                <Badge flexShrink={0} colorScheme={files.length ? "green" : "gray"} borderRadius="full" px={3} py={1}>{files.length} {t("Files")}</Badge>
              </Flex>
              <Upload count={files.length} onFileSelect={setFiles} />
              {files.length > 0 && (
                <Box mt={3} maxH="120px" overflowY="auto">
                  {files.map((file, index) => (
                    <Flex key={`${file.name}-${index}`} align="center" justify="space-between" gap={2} py={2} borderBottom={index < files.length - 1 ? "1px solid" : "0"} borderColor={border}>
                      <Flex align="center" gap={2} minW={0}><Icon as={FiFile} color="brand.500" /><Text fontSize="sm" fontWeight="700" noOfLines={1}>{file.name}</Text></Flex>
                      <Text fontSize="xs" color="gray.500" flexShrink={0}>{Math.ceil(file.size / 1024)} KB</Text>
                    </Flex>
                  ))}
                </Box>
              )}
            </Box>

            <Box bg={surface} border="1px solid" borderColor={border} borderRadius="18px" p={{ base: 3, md: 4 }}>
              <Box mb={4}>
                <Text fontWeight="900">{t("2. Information and category")}</Text>
                <Text fontSize="sm" color="gray.500">{t("Folder and related record are optional; category is used to filter documents.")}</Text>
              </Box>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <Box>
                  <FormLabel fontSize="sm" fontWeight="800">{t("Storage location")}</FormLabel>
                  <Select value={targetFolder} onChange={(event) => setTargetFolder(event.target.value)} borderRadius="12px">
                    <option value="">{t("No folder — publish directly")}</option>
                    {realFolders.map((folder) => <option key={folder._id} value={folder._id}>{folder.folderName}</option>)}
                  </Select>
                </Box>
                <Box>
                  <FormLabel fontSize="sm" fontWeight="800">{t("Section / category")}</FormLabel>
                  <Select value={category} onChange={(event) => setCategory(event.target.value)} borderRadius="12px">
                    {categories.map((item) => <option key={item.value} value={item.value}>{t(item.label)}</option>)}
                  </Select>
                </Box>
                <Box>
                  <FormLabel fontSize="sm" fontWeight="800">{t("Display file name")} <Text as="span" color="gray.400" fontWeight="500">({t("Optional")})</Text></FormLabel>
                  <Input value={fileName} onChange={(event) => setFileName(event.target.value)} placeholder={t("The original name is kept when this field is empty")} borderRadius="12px" />
                </Box>
                {entityType ? (
                  <Box>
                    <FormLabel fontSize="sm" fontWeight="800">{t("Related record")} <Text as="span" color="gray.400" fontWeight="500">({t("Optional")})</Text></FormLabel>
                    <Select value={entityId} onChange={(event) => setEntityId(event.target.value)} placeholder={t("No related record")} borderRadius="12px">
                      {entityOptions.map((item) => <option key={item._id} value={item._id}>{optionLabel(item, entityType)}</option>)}
                    </Select>
                  </Box>
                ) : (
                  <Box p={3} bg={subtle} borderRadius="12px"><Text fontSize="sm" color="gray.500">{t("This category does not need a related record.")}</Text></Box>
                )}
              </SimpleGrid>
            </Box>
          </ModalBody>
          <ModalFooter bg={surface} borderTop="1px solid" borderColor={border} gap={2} flexWrap="wrap" px={{ base: 3, md: 6 }}>
            <Text width={{ base: "100%", md: "auto" }} me={{ md: "auto" }} fontSize="sm" color="gray.500">
              {t(targetFolder ? "Files will be saved in the selected folder." : "Files will be published without a folder.")}
            </Text>
            <Button flex={{ base: 1, sm: "initial" }} variant="ghost" onClick={uploadModal.onClose}>{t("Cancel")}</Button>
            <Button flex={{ base: 1, sm: "initial" }} variant="brand" minW={{ sm: "140px" }} onClick={uploadFiles} isLoading={loading} isDisabled={!files.length}>
              {t("Upload")} {files.length ? `${files.length} ${t("Files")}` : t("Document")}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default DocumentPage;
