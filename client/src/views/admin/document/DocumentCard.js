import { Badge, Box, Flex, Icon, IconButton, Text, useColorModeValue } from '@chakra-ui/react';
import { FiDownload, FiFile, FiImage } from 'react-icons/fi';
import { useLanguage } from 'i18n';
import SharedRecordBadge from 'components/SharedRecordBadge';
import DocumentInformation from './DocumentInformation';
import { categories, categoryOf } from './documentCategories';

export default function DocumentCard({ file, folder, definition, onDownload, actions, deleteAction }) {
  const { t } = useLanguage();
  const surface = useColorModeValue('white', 'navy.700');
  const border = useColorModeValue('gray.200', 'whiteAlpha.200');
  const category = categories.find(item => item.value === categoryOf(file));
  const isImage = file.mimeType?.startsWith('image/');
  return <Box className="crm-document-card" data-document-id={file._id} bg={surface} border="1px solid" borderColor={border} borderRadius="16px" p={4} minW={0}>
    <Flex gap={3} minW={0}>
      <Flex w="42px" h="42px" borderRadius="12px" bg={isImage ? 'purple.50' : 'blue.50'} align="center" justify="center" flexShrink={0}>
        <Icon as={isImage ? FiImage : FiFile} color={isImage ? 'purple.500' : 'blue.500'} boxSize={5} />
      </Flex>
      <Box minW={0}>
        <Text fontWeight="800" noOfLines={1} title={file.fileName}>{file.fileName}</Text><SharedRecordBadge module="Documents" record={file} />
        <Text fontSize="xs" color="gray.500">{file.size ? `${Math.ceil(file.size / 1024)} KB` : t('File')}</Text>
      </Box>
    </Flex>
    <Badge mt={3} colorScheme="brand" borderRadius="full">{t(category?.label || 'General')}</Badge>
    <DocumentInformation file={file} category={category?.label} definition={definition} folderName={folder?.isRoot ? '' : folder?.folderName} />
    <Flex mt={4} gap={2} justify="flex-end" wrap="wrap">
      {actions}
      <IconButton aria-label={t('Download')} icon={<FiDownload />} size="sm" variant="ghost" onClick={() => onDownload(file)} />
      {deleteAction}
    </Flex>
  </Box>;
}
