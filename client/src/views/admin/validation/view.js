import { LocalizedText, tr, withLocalization } from 'i18n/runtime';
import { DeleteIcon, EditIcon } from "@chakra-ui/icons";
import {
  Box,
  Button,
  Flex,
  Grid,
  GridItem,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
} from "@chakra-ui/react";
import { HSeparator } from "components/separator/Separator";
import Spinner from "components/spinner/Spinner";
import React, { useEffect, useState } from "react";
import { getApi } from "services/api";
import Edit from "./Edit";

const View = (props) => {
  const { onClose, isOpen, selectedId, fetchData, setAction } = props;
  const [isLoding, setIsLoding] = useState(false);
  const [data, setData] = useState(false);
  const [editModal, setEditModal] = useState(false);

  const handleEditClose = () => {
    setEditModal(false);
  };

  const fetchViewData = async () => {
    setIsLoding(true);
    try {
      if (selectedId) {
        let response = await getApi(`api/validation/view/`, selectedId);
        setData(response?.data);
      }
    } catch (error) {
      console.log(error);
    } finally {
      setIsLoding(false);
    }
  };
  useEffect(() => {
    fetchViewData();
  }, [selectedId, editModal]);

  return (
    <div>
      <Modal onClose={onClose} isOpen={isOpen} isCentered size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader textTransform={"capitalize"}>{data?.name} </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Box>
              <Grid templateColumns="repeat(12, 1fr)" gap={3}>
                <GridItem colSpan={{ base: 12 }}>
                  <Flex>
                    <Text
                      fontWeight={"bold"}
                      pr={2}
                      textTransform={"capitalize"}
                    ><LocalizedText text="require :" /></Text>
                    <Text>
                      {data?.validations &&
                      data?.validations?.length > 0 &&
                      data?.validations[0]?.require === true
                        ? tr("True")
                        : tr("False")}
                    </Text>
                  </Flex>
                </GridItem>
                {data?.validations &&
                  data?.validations?.length > 0 &&
                  data?.validations[0]?.require === true && (
                    <GridItem colSpan={{ base: 12 }}>
                      <Flex>
                        <Text
                          display="flex"
                          ms="4px"
                          fontSize="sm"
                          fontWeight={"bold"}
                          mb="0"
                        ><LocalizedText text="Message :" /></Text>
                        <Text
                          display="flex"
                          ms="4px"
                          fontSize="sm"
                          fontWeight="500"
                          mb="0"
                        >
                          {data?.validations &&
                            data?.validations?.length > 0 &&
                            data?.validations[0]?.message}
                        </Text>
                      </Flex>
                    </GridItem>
                  )}
                <GridItem colSpan={{ base: 12 }}>
                  <HSeparator />
                </GridItem>
                <GridItem colSpan={{ base: 12 }}>
                  <Flex>
                    <Text
                      fontWeight={"bold"}
                      pr={2}
                      textTransform={"capitalize"}
                    ><LocalizedText text="Min :" /></Text>
                    <Text>
                      {data?.validations &&
                      data?.validations?.length > 0 &&
                      data?.validations[1]?.min === true
                        ? tr("True")
                        : tr("False")}
                    </Text>
                  </Flex>
                </GridItem>
                {data?.validations &&
                  data?.validations?.length > 0 &&
                  data?.validations[1]?.min === true && (
                    <>
                      <GridItem colSpan={{ base: 12, sm: 6 }}>
                        <Flex>
                          <Text
                            display="flex"
                            ms="4px"
                            fontSize="sm"
                            fontWeight={"bold"}
                            mb="0"
                          ><LocalizedText text="Message:" /></Text>
                          <Text
                            display="flex"
                            ms="4px"
                            fontSize="sm"
                            fontWeight="500"
                            mb="0"
                          >
                            {data?.validations &&
                              data?.validations?.length > 0 &&
                              data?.validations[1]?.message}
                          </Text>
                        </Flex>
                      </GridItem>
                      <GridItem colSpan={{ base: 12, sm: 6 }}>
                        <Flex>
                          <Text
                            display="flex"
                            ms="4px"
                            fontSize="sm"
                            fontWeight={"bold"}
                            mb="0"
                          ><LocalizedText text="Value :" /></Text>
                          <Text
                            display="flex"
                            ms="4px"
                            fontSize="sm"
                            fontWeight="500"
                            mb="0"
                          >
                            {data?.validations &&
                              data?.validations?.length > 0 &&
                              data?.validations[1]?.message}
                          </Text>
                        </Flex>
                      </GridItem>
                    </>
                  )}
                <GridItem colSpan={{ base: 12 }}>
                  <HSeparator />
                </GridItem>

                <GridItem colSpan={{ base: 12 }}>
                  <Flex>
                    <Text
                      fontWeight={"bold"}
                      pr={2}
                      textTransform={"capitalize"}
                    ><LocalizedText text="Max :" /></Text>
                    <Text>
                      {data?.validations &&
                      data?.validations?.length > 0 &&
                      data?.validations[2]?.max === true
                        ? tr("True")
                        : tr("False")}
                    </Text>
                  </Flex>
                </GridItem>
                {data?.validations &&
                  data?.validations?.length > 0 &&
                  data?.validations[2]?.max === true && (
                    <>
                      <GridItem colSpan={{ base: 12, sm: 6 }}>
                        <Flex>
                          <Text
                            display="flex"
                            ms="4px"
                            fontSize="sm"
                            fontWeight={"bold"}
                            mb="0"
                          ><LocalizedText text="Message:" /></Text>
                          <Text
                            display="flex"
                            ms="4px"
                            fontSize="sm"
                            fontWeight="500"
                            mb="0"
                          >
                            {data?.validations &&
                              data?.validations?.length > 0 &&
                              data?.validations[2]?.message}
                          </Text>
                        </Flex>
                      </GridItem>
                      <GridItem colSpan={{ base: 12, sm: 6 }}>
                        <Flex>
                          <Text
                            display="flex"
                            ms="4px"
                            fontSize="sm"
                            fontWeight={"bold"}
                            mb="0"
                          ><LocalizedText text="Value :" /></Text>
                          <Text
                            display="flex"
                            ms="4px"
                            fontSize="sm"
                            fontWeight="500"
                            mb="0"
                          >
                            {data?.validations &&
                              data?.validations?.length > 0 &&
                              data?.validations[2]?.message}
                          </Text>
                        </Flex>
                      </GridItem>
                    </>
                  )}
                <GridItem colSpan={{ base: 12 }}>
                  <HSeparator />
                </GridItem>
                <GridItem colSpan={{ base: 12 }}>
                  <Flex>
                    <Text
                      fontWeight={"bold"}
                      pr={2}
                      textTransform={"capitalize"}
                    ><LocalizedText text="Match:" /></Text>
                    <Text>
                      {data?.validations &&
                      data?.validations?.length > 0 &&
                      data?.validations[3]?.match === true
                        ? tr("True")
                        : tr("False")}
                    </Text>
                  </Flex>
                </GridItem>
                {data?.validations &&
                  data?.validations?.length > 0 &&
                  data?.validations[3]?.match === true && (
                    <>
                      <GridItem colSpan={{ base: 12, sm: 6 }}>
                        <Flex>
                          <Text
                            display="flex"
                            ms="4px"
                            fontSize="sm"
                            fontWeight={"bold"}
                            mb="0"
                          ><LocalizedText text="Message:" /></Text>
                          <Text
                            display="flex"
                            ms="4px"
                            fontSize="sm"
                            fontWeight="500"
                            mb="0"
                          >
                            {data?.validations &&
                              data?.validations?.length > 0 &&
                              data?.validations[3]?.message}
                          </Text>
                        </Flex>
                      </GridItem>
                      <GridItem colSpan={{ base: 12, sm: 6 }}>
                        <Flex>
                          <Text
                            display="flex"
                            ms="4px"
                            fontSize="sm"
                            fontWeight={"bold"}
                            mb="0"
                          ><LocalizedText text="Value :" /></Text>
                          <Text
                            display="flex"
                            ms="4px"
                            fontSize="sm"
                            fontWeight="500"
                            mb="0"
                          >
                            {data?.validations &&
                              data?.validations?.length > 0 &&
                              data?.validations[3]?.message}
                          </Text>
                        </Flex>
                      </GridItem>
                    </>
                  )}
                <GridItem colSpan={{ base: 12 }}>
                  <HSeparator />
                </GridItem>

                <GridItem colSpan={{ base: 12 }}>
                  <Flex>
                    <Text
                      fontWeight={"bold"}
                      pr={2}
                      textTransform={"capitalize"}
                    ><LocalizedText text="FormikType :" /></Text>
                    <Text>
                      {data?.validations &&
                      data?.validations?.length > 0 &&
                      data?.validations[4]?.formikType
                        ? tr("True")
                        : tr("False")}
                    </Text>
                  </Flex>
                </GridItem>
                {data?.validations &&
                  data?.validations?.length > 0 &&
                  data?.validations[4]?.formikType && (
                    <GridItem colSpan={{ base: 12 }}>
                      <Flex>
                        <Text
                          display="flex"
                          ms="4px"
                          fontSize="sm"
                          fontWeight={"bold"}
                          mb="0"
                        ><LocalizedText text="Message :" /></Text>
                        <Text
                          display="flex"
                          ms="4px"
                          fontSize="sm"
                          fontWeight="500"
                          mb="0"
                        >
                          {data?.validations &&
                            data?.validations?.length > 0 &&
                            data?.validations[4]?.message}
                        </Text>
                      </Flex>
                    </GridItem>
                  )}
                <GridItem colSpan={{ base: 12 }}>
                  <HSeparator />
                </GridItem>
              </Grid>
            </Box>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="outline"
              colorScheme="green"
              size="sm"
              me={2}
              onClick={() => {
                onClose();
                setEditModal(true);
              }}
              leftIcon={<EditIcon />}
            ><LocalizedText text="Edit" /></Button>
            <Button
              colorScheme="red"
              size="sm"
              mr={2}
              disabled={isLoding ? true : false}
              leftIcon={<DeleteIcon />}
            >
              {isLoding ? <Spinner /> : tr("Delete")}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      <Edit
        isOpen={editModal}
        onClose={handleEditClose}
        selectedId={props?.selectedId}
        editdata={data}
        setAction={setAction}
        fetchData={fetchData}
        fetchViewData={fetchViewData}
      />
    </div>
  );
};

export default withLocalization(View);
