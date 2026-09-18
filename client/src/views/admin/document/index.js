import {
  Badge, Box, Breadcrumb, BreadcrumbItem, BreadcrumbLink, Button, Flex, FormLabel,
  Grid, GridItem, Heading, Icon, IconButton, Input, Modal, ModalBody, ModalCloseButton,
  ModalContent, ModalFooter, ModalHeader, ModalOverlay, Select, SimpleGrid, Text,
  useColorModeValue, useDisclosure,
} from "@chakra-ui/react";
import Card from "components/card/Card";
import Spinner from "components/spinner/Spinner";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { deleteApi, getApi, getApiBlob, postApi } from "services/api";
import Upload from "./component/Upload";
import {
  FiChevronLeft, FiDownload, FiFile, FiFolder, FiFolderPlus, FiImage,
  FiPlus, FiTrash2,
} from "react-icons/fi";

const entityTypes = [
  { value: "", label: "بدون ارتباط" },
  { value: "Property", label: "ملک" },
  { value: "Lead", label: "لید" },
  { value: "Opportunity", label: "فرصت" },
  { value: "PartnerCustomer", label: "مشتری همکار" },
  { value: "Contact", label: "مخاطب" },
];

const optionLabel = (item, type) => {
  if (type === "Property") return item.title || item.name || item.propertyAddress;
  if (type === "Lead") return item.leadName || item.leadEmail;
  if (type === "Opportunity") return item.opportunityName;
  if (type === "PartnerCustomer") return item.companyName || item.fullName;
  return [item.firstName, item.lastName].filter(Boolean).join(" ") || item.email;
};

const entityEndpoint = (type) => ({
  Property: "api/property",
  Lead: "api/lead",
  Opportunity: "api/opportunity",
  PartnerCustomer: "api/estate/Partner%20Customers?limit=100",
  Contact: "api/contact",
}[type]);

const DocumentPage = () => {
  const [folders, setFolders] = useState([]);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [folderName, setFolderName] = useState("");
  const [files, setFiles] = useState([]);
  const [fileName, setFileName] = useState("");
  const [entityType, setEntityType] = useState("");
  const [entityId, setEntityId] = useState("");
  const [entityOptions, setEntityOptions] = useState([]);
  const [filterType, setFilterType] = useState("");
  const [loading, setLoading] = useState(false);
  const uploadModal = useDisclosure();
  const folderModal = useDisclosure();
  const surface = useColorModeValue("white", "navy.700");
  const subtle = useColorModeValue("gray.50", "navy.800");
  const border = useColorModeValue("gray.200", "whiteAlpha.200");

  const fetchFolders = async () => {
    setLoading(true);
    const result = await getApi("api/document");
    if (result?.status === 200) {
      setFolders(result.data || []);
      if (currentFolder) {
        const refreshed = result.data.find((item) => item._id === currentFolder._id);
        if (refreshed) setCurrentFolder(refreshed);
      }
    } else toast.error("دریافت اسناد ناموفق بود");
    setLoading(false);
  };

  useEffect(() => { fetchFolders(); }, []);

  useEffect(() => {
    setEntityId("");
    setEntityOptions([]);
    if (!entityType) return;
    getApi(entityEndpoint(entityType)).then((result) => {
      const data = entityType === "PartnerCustomer" ? result?.data?.items : result?.data;
      if (result?.status === 200) setEntityOptions(data || []);
    });
  }, [entityType]);

  const children = useMemo(() => folders.filter((folder) =>
    String(folder.parentFolder || "") === String(currentFolder?._id || "")
  ), [folders, currentFolder]);

  const visibleFiles = useMemo(() => (currentFolder?.files || []).filter((file) =>
    !filterType || file.entityType === filterType
  ), [currentFolder, filterType]);

  const parentFolder = currentFolder?.parentFolder
    ? folders.find((item) => item._id === currentFolder.parentFolder)
    : null;

  const createFolder = async () => {
    if (!folderName.trim()) return;
    setLoading(true);
    const result = await postApi("api/document/folder", { folderName, parentFolder: currentFolder?._id || null });
    setLoading(false);
    if (result?.status === 200 || result?.status === 201) {
      setFolderName("");
      folderModal.onClose();
      fetchFolders();
    } else toast.error(result?.data?.message || "ساخت پوشه ناموفق بود");
  };

  const uploadFiles = async () => {
    if (!currentFolder || !files.length) return toast.error("ابتدا پوشه و فایل را انتخاب کنید");
    const body = new FormData();
    body.append("folderId", currentFolder._id);
    body.append("filename", fileName);
    if (entityType && entityId) {
      body.append("entityType", entityType);
      body.append("entityId", entityId);
    }
    files.forEach((file) => body.append("files", file));
    setLoading(true);
    const result = await postApi("api/document/add", body);
    setLoading(false);
    if (result?.status === 200) {
      setFiles([]); setFileName(""); setEntityType(""); setEntityId("");
      uploadModal.onClose();
      await fetchFolders();
      toast.success("فایل‌ها با موفقیت بارگذاری شدند");
    } else toast.error(result?.data?.message || "بارگذاری فایل ناموفق بود");
  };

  const download = async (file) => {
    const result = await getApiBlob(`api/document/download/${file._id}`);
    if (result?.status !== 200) return toast.error("فایل پیدا نشد");
    const url = URL.createObjectURL(result.data);
    const anchor = window.document.createElement("a");
    anchor.href = url; anchor.download = file.fileName; anchor.click();
    URL.revokeObjectURL(url);
  };

  const removeFile = async (file) => {
    if (!window.confirm(`فایل «${file.fileName}» حذف شود؟`)) return;
    const result = await deleteApi("api/document/delete/", file._id);
    if (result?.status === 200) fetchFolders();
    else toast.error("حذف فایل ناموفق بود");
  };

  return (
    <Box>
      <Flex justify="space-between" align={{ base: "stretch", md: "center" }} direction={{ base: "column", md: "row" }} gap={3} mb={5}>
        <Box>
          <Heading size="lg">مرکز اسناد</Heading>
          <Text color="gray.500" mt={1}>فایل‌های هر ملک، لید، فرصت، مخاطب یا مشتری همکار را یک‌جا مدیریت کنید.</Text>
        </Box>
        <Flex gap={2}>
          <Button leftIcon={<FiFolderPlus />} variant="outline" onClick={folderModal.onOpen}>پوشه جدید</Button>
          <Button leftIcon={<FiPlus />} variant="brand" onClick={uploadModal.onOpen} isDisabled={!currentFolder}>بارگذاری سند</Button>
        </Flex>
      </Flex>

      <Grid templateColumns="repeat(12, 1fr)" gap={4}>
        <GridItem colSpan={{ base: 12, lg: 3 }}>
          <Card minH="620px" p={4}>
            <Text fontWeight="800" mb={3}>پوشه‌ها</Text>
            <Button variant="ghost" justifyContent="flex-start" w="100%" leftIcon={<FiFolder />} onClick={() => setCurrentFolder(null)} colorScheme={!currentFolder ? "brand" : "gray"}>همه اسناد</Button>
            {folders.filter((item) => !item.parentFolder).map((folder) => (
              <Button key={folder._id} variant={currentFolder?._id === folder._id ? "solid" : "ghost"} colorScheme={currentFolder?._id === folder._id ? "brand" : "gray"} justifyContent="flex-start" w="100%" leftIcon={<FiFolder />} onClick={() => setCurrentFolder(folder)} mt={1}>
                <Text noOfLines={1}>{folder.folderName}</Text>
              </Button>
            ))}
          </Card>
        </GridItem>

        <GridItem colSpan={{ base: 12, lg: 9 }}>
          <Card minH="620px" p={5}>
            <Flex justify="space-between" align="center" mb={5} gap={3} wrap="wrap">
              <Breadcrumb separator={<FiChevronLeft />}>
                <BreadcrumbItem><BreadcrumbLink onClick={() => setCurrentFolder(null)}>اسناد</BreadcrumbLink></BreadcrumbItem>
                {parentFolder && <BreadcrumbItem><BreadcrumbLink onClick={() => setCurrentFolder(parentFolder)}>{parentFolder.folderName}</BreadcrumbLink></BreadcrumbItem>}
                {currentFolder && <BreadcrumbItem isCurrentPage><BreadcrumbLink>{currentFolder.folderName}</BreadcrumbLink></BreadcrumbItem>}
              </Breadcrumb>
              <Select size="sm" w="190px" value={filterType} onChange={(event) => setFilterType(event.target.value)}>
                <option value="">همه ارتباط‌ها</option>
                {entityTypes.slice(1).map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
              </Select>
            </Flex>

            {loading ? <Flex minH="350px" align="center" justify="center"><Spinner /></Flex> : (
              <>
                <SimpleGrid columns={{ base: 2, md: 3, xl: 4 }} spacing={3} mb={6}>
                  {children.map((folder) => (
                    <Box key={folder._id} p={4} bg={subtle} border="1px solid" borderColor={border} borderRadius="16px" cursor="pointer" onClick={() => setCurrentFolder(folder)} _hover={{ transform: "translateY(-2px)", boxShadow: "md" }} transition="all .2s">
                      <Icon as={FiFolder} color="brand.500" boxSize={7} />
                      <Text mt={2} fontWeight="800" noOfLines={1}>{folder.folderName}</Text>
                      <Text fontSize="xs" color="gray.500">{folder.files?.length || 0} فایل</Text>
                    </Box>
                  ))}
                </SimpleGrid>

                {!currentFolder ? (
                  <Flex minH="300px" direction="column" align="center" justify="center" bg={subtle} borderRadius="20px" border="1px dashed" borderColor={border}>
                    <Icon as={FiFolder} boxSize={14} color="brand.300" />
                    <Text fontWeight="800" mt={3}>یک پوشه را انتخاب کنید</Text>
                    <Text color="gray.500" fontSize="sm">یا برای شروع یک پوشه جدید بسازید.</Text>
                  </Flex>
                ) : visibleFiles.length === 0 && children.length === 0 ? (
                  <Flex minH="300px" direction="column" align="center" justify="center" bg={subtle} borderRadius="20px">
                    <Icon as={FiFile} boxSize={12} color="gray.300" />
                    <Text fontWeight="800" mt={3}>این پوشه هنوز خالی است</Text>
                    <Button size="sm" variant="brand" mt={3} onClick={uploadModal.onOpen}>اولین سند را بارگذاری کنید</Button>
                  </Flex>
                ) : (
                  <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={3}>
                    {visibleFiles.map((file) => {
                      const linked = entityTypes.find((item) => item.value === file.entityType)?.label;
                      return (
                        <Box key={file._id} bg={surface} border="1px solid" borderColor={border} borderRadius="16px" p={4}>
                          <Flex justify="space-between" align="start">
                            <Flex gap={3} minW={0}>
                              <Flex w="42px" h="42px" borderRadius="12px" bg={file.mimeType?.startsWith("image/") ? "purple.50" : "blue.50"} align="center" justify="center" flexShrink={0}>
                                <Icon as={file.mimeType?.startsWith("image/") ? FiImage : FiFile} color={file.mimeType?.startsWith("image/") ? "purple.500" : "blue.500"} boxSize={5} />
                              </Flex>
                              <Box minW={0}><Text fontWeight="800" noOfLines={1}>{file.fileName}</Text><Text fontSize="xs" color="gray.500">{file.size ? `${Math.ceil(file.size / 1024)} KB` : "فایل"}</Text></Box>
                            </Flex>
                          </Flex>
                          {linked && <Badge mt={3} colorScheme="brand" borderRadius="full">{linked}</Badge>}
                          <Flex mt={4} gap={2} justify="flex-end">
                            <IconButton aria-label="Download" icon={<FiDownload />} size="sm" variant="ghost" onClick={() => download(file)} />
                            <IconButton aria-label="Delete" icon={<FiTrash2 />} size="sm" variant="ghost" colorScheme="red" onClick={() => removeFile(file)} />
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
        <ModalOverlay /><ModalContent><ModalHeader>پوشه جدید</ModalHeader><ModalCloseButton /><ModalBody>
          <FormLabel>نام پوشه</FormLabel><Input value={folderName} onChange={(event) => setFolderName(event.target.value)} autoFocus />
          {currentFolder && <Text fontSize="xs" color="gray.500" mt={2}>این پوشه داخل «{currentFolder.folderName}» ساخته می‌شود.</Text>}
        </ModalBody><ModalFooter><Button variant="brand" onClick={createFolder} isLoading={loading}>ساخت پوشه</Button></ModalFooter></ModalContent>
      </Modal>

      <Modal isOpen={uploadModal.isOpen} onClose={uploadModal.onClose} size="xl" isCentered>
        <ModalOverlay /><ModalContent><ModalHeader>بارگذاری سند در {currentFolder?.folderName}</ModalHeader><ModalCloseButton /><ModalBody>
          <Upload count={files.length} onFileSelect={setFiles} />
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
            <Box><FormLabel fontSize="sm">نام نمایشی فایل (اختیاری)</FormLabel><Input value={fileName} onChange={(event) => setFileName(event.target.value)} /></Box>
            <Box><FormLabel fontSize="sm">نوع ارتباط</FormLabel><Select value={entityType} onChange={(event) => setEntityType(event.target.value)}>{entityTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></Box>
            {entityType && <Box gridColumn={{ md: "span 2" }}><FormLabel fontSize="sm">انتخاب رکورد</FormLabel><Select value={entityId} onChange={(event) => setEntityId(event.target.value)} placeholder="انتخاب کنید">{entityOptions.map((item) => <option key={item._id} value={item._id}>{optionLabel(item, entityType)}</option>)}</Select></Box>}
          </SimpleGrid>
        </ModalBody><ModalFooter><Button variant="brand" onClick={uploadFiles} isLoading={loading} isDisabled={!files.length || (entityType && !entityId)}>بارگذاری</Button></ModalFooter></ModalContent>
      </Modal>
    </Box>
  );
};

export default DocumentPage;
