import { LocalizedText } from 'i18n/runtime';
import {
  Button,
  Grid,
  GridItem,
  Modal,
  ModalBody,
  ModalCloseButton,
  Box,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Radio,
  Text,
  RadioGroup,
} from "@chakra-ui/react";

const BankDetailsModel = (props) => {
  const {
    onClose,
    isOpen,
    bankAllDetails,
    selectedRecord,
    setSelectedRecord,
    setFieldValue,
  } = props;

  const handleRadioChange = (selectedId) => {
    const record = bankAllDetails?.data?.find(
      (item) => item?._id === selectedId
    );
    setSelectedRecord(record);
    if (record) {
      setFieldValue("accountNumber", record.accountNumber);
      setFieldValue("accountName", record.accountName);
      setFieldValue("bank", record.bank);
      setFieldValue("branch", record.branch);
      setFieldValue("swiftCode", record.swiftCode);
    }
  };

  const selectHandleClose = () => {
    if (selectedRecord) {
      onClose();
    }
  };

  return (
    <Modal onClose={onClose} isOpen={isOpen} isCentered size="full">
      <ModalOverlay />
      <ModalContent height={"580px"}>
        <ModalHeader><LocalizedText text="Bank Details" /></ModalHeader>
        <ModalCloseButton />
        <ModalBody overflowY={"auto"} height={"400px"}>
          <Grid templateColumns="repeat(12, 1fr)" gap={3}>
            {bankAllDetails?.data?.map((item) => (
              <GridItem key={item?._id} colSpan={{ base: 12, md: 6, lg: 4 }}>
                <div
                  style={{
                    background: "#F9F9F9",
                    padding: "10px",
                    borderRadius: "8px",
                  }}
                >
                  <Box>
                    <Text style={{ marginLeft: "20px" }} fontWeight="bold">
                      {item?.accountName}
                    </Text>
                    <Text style={{ marginLeft: "20px" }}>
                      {" "}<LocalizedText text="Account Number:" />{item?.accountNumber}
                    </Text>

                    <Box display="flex" alignItems="center">
                      <RadioGroup
                        onChange={handleRadioChange}
                        value={selectedRecord?._id || ""}
                        style={{ marginRight: "5px", display: "flex" }}
                      >
                        <Radio value={item?._id} />
                      </RadioGroup>
                      <Text><LocalizedText text="Swift Code:" />{item?.swiftCode}</Text>
                    </Box>
                    <Text style={{ marginLeft: "20px" }}><LocalizedText text="Bank:" />{item?.bank}
                    </Text>
                    <Text style={{ marginLeft: "20px" }}><LocalizedText text="Branch:" />{item?.branch}
                    </Text>
                  </Box>
                </div>
              </GridItem>
            ))}
          </Grid>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="brand"
            size="sm"
            onClick={() => {
              handleRadioChange(selectedRecord?._id);
              selectHandleClose();
            }}
          ><LocalizedText text="Select" /></Button>
          <Button
            sx={{
              marginLeft: 2,
              textTransform: "capitalize",
            }}
            variant="outline"
            colorScheme="red"
            onClick={() => {
              onClose();
            }}
            size="sm"
          ><LocalizedText text="Close" /></Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
export default BankDetailsModel;
