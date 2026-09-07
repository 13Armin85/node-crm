import { LocalizedText, tr, withLocalization } from 'i18n/runtime';
import {
  Button,
  Flex,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
} from "@chakra-ui/react";
import Spinner from "components/spinner/Spinner";
import { useState } from "react";
import { GiClick } from "react-icons/gi";
import RoleTable from "./Role.js";

const MultiRoleModel = (props) => {
  const { onClose, isOpen, fieldName, setFieldValue, data, role } = props;
  const [selectedValues, setSelectedValues] = useState([]);
  const [roleData, setRoleData] = useState([]);
  const [isLoding, setIsLoding] = useState(false);
  const user = JSON.parse(localStorage.getItem("user"));

  const uniqueValues = [...new Set(selectedValues)];

  const handleSubmit = async () => {
    try {
      setIsLoding(true);
      setFieldValue(fieldName, uniqueValues);
      onClose();
    } catch (e) {
      console.log(e);
    } finally {
      setIsLoding(false);
    }
  };
  const columns = [
    {
      Header: tr("#"),
      accessor: "_id",
      isSortable: false,
      width: 10,
      display: false,
    },
    {
      Header: tr("Role Name"),
      accessor: "roleName",
    },
    { Header: tr("Description"), accessor: "description" },
  ];
  return (
    <Modal onClose={onClose} size="full" isOpen={isOpen}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader><LocalizedText text="Select Role" /></ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {isLoding ? (
            <Flex justifyContent={"center"} alignItems={"center"} width="100%">
              <Spinner />
            </Flex>
          ) : (
            <RoleTable
              title={tr("Role")}
              isLoding={isLoding}
              allData={role}
              tableData={role}
              type="multi"
              tableCustomFields={
                roleData?.[0]?.fields?.filter(
                  (field) => field?.isTableField === true,
                ) || []
              }
              selectedValues={selectedValues}
              setSelectedValues={setSelectedValues}
              columnsData={columns ?? []}
            />
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            variant="brand"
            onClick={handleSubmit}
            disabled={isLoding ? true : false}
            leftIcon={<GiClick />}
          >
            {" "}
            {isLoding ? <Spinner /> : tr("Select")}
          </Button>
          <Button onClick={() => onClose()}><LocalizedText text="Close" /></Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default withLocalization(MultiRoleModel);
