import { LocalizedText, tr, withLocalization } from 'i18n/runtime';
import {
  Button,
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
import { useNavigate, useParams } from "react-router-dom";

const CommonDeleteModel = (props) => {
  const { isOpen, onClose, type, handleDeleteData, ids, selectedValues } =
    props;
  const [isLoding, setIsLoding] = useState(false);

  const handleDelete = () => {
    handleDeleteData(ids, selectedValues);
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <div>
      <Modal onClose={onClose} isOpen={isOpen} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader><LocalizedText text="Delete" />{`${type}`}</ModalHeader>
          <ModalCloseButton />
          <ModalBody><LocalizedText text="Are You Sure To Delete selected" />{`${type}`} ?</ModalBody>
          <ModalFooter>
            <Button
              colorScheme="red"
              size="sm"
              mr={2}
              onClick={handleDelete}
              disabled={isLoding ? true : false}
            >
              {isLoding ? <Spinner /> : tr("Yes")}
            </Button>
            <Button variant="outline" size="sm" onClick={handleClose}><LocalizedText text="No" /></Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
};

export default withLocalization(CommonDeleteModel);
