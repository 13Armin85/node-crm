import { LocalizedText, tr, withLocalization } from 'i18n/runtime';
import { CloseIcon } from "@chakra-ui/icons";
import {
  Button,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  IconButton,
  Image,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Spinner,
} from "@chakra-ui/react";
import moment from "moment";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { getApi } from "services/api";

const Preview = (props) => {
  const { onClose, isOpen, id, generatePDF, selectedId, isLoading } = props;
  const [invoiceDetails, setInvoiceDetails] = useState({});
  const [isLoding, setIsLoding] = useState(false);
  const largeLogo = useSelector((state) =>
    state?.images?.images?.filter((item) => item?.isActive === true),
  );

  const fetchInvoiceDetails = async () => {
    try {
      setIsLoding(true);
      let result = await getApi("api/invoices/view/", selectedId);
      if (result?.status === 200) {
        setInvoiceDetails(result?.data?.result);
      }
    } catch (e) {
      console.log(e);
    } finally {
      setIsLoding(false);
    }
  };

  useEffect(() => {
    if (selectedId) fetchInvoiceDetails();
  }, [selectedId]);

  return (
    <Drawer isOpen={isOpen} size={"lg"}>
      <DrawerContent>
        <DrawerHeader
          alignItems={"center"}
          justifyContent="space-between"
          display="flex"
        ><LocalizedText text="Invoice" /><IconButton onClick={() => onClose(false)} icon={<CloseIcon />} />
        </DrawerHeader>
        <DrawerBody>
          {!isLoding ? (
            <div id={id} style={{ padding: "5px" }}>
              <div className="invoice-container">
                <div style={{ marginBottom: 10 }}>
                  <h1 style={{ fontSize: 30, textAlign: "center" }}><LocalizedText text="Invoice" /></h1>
                </div>
                <div className="invoice-header">
                  <div>
                    <Image
                      style={{ width: "100%", height: "52px" }}
                      src={largeLogo[0]?.logoLgImg}
                      alt="Logo"
                      cursor="pointer"
                      userSelect="none"
                      my={2}
                    />
                  </div>
                  <div className="invoice-details">
                    <table>
                      <tr>
                        <th style={{ textAlign: "start" }}><LocalizedText text="Invoice No." /></th>
                        <td>:</td>
                        <td style={{ textAlign: "start" }}>
                          {invoiceDetails?.invoiceNumber}
                        </td>
                      </tr>
                      <tr>
                        <th style={{ textAlign: "start" }}><LocalizedText text="Invoice Date" /></th>
                        <td>:</td>
                        <td style={{ textAlign: "start" }}>
                          {invoiceDetails?.invoiceDate &&
                            moment(invoiceDetails?.invoiceDate).format(
                              "DD-MM-YYYY",
                            )}
                        </td>
                      </tr>
                      <tr>
                        <th style={{ textAlign: "start" }}><LocalizedText text="Name" /></th>
                        <td>:</td>
                        <td style={{ textAlign: "start" }}>
                          {invoiceDetails?.title}
                        </td>
                      </tr>
                      <tr>
                        <th style={{ textAlign: "start" }}><LocalizedText text="Status" /></th>
                        <td>:</td>
                        <td style={{ textAlign: "start" }}>
                          {invoiceDetails?.status}
                        </td>
                      </tr>
                    </table>
                  </div>
                </div>
                <div className="address-section">
                  <div className="address">
                    <strong><LocalizedText text="Billing Address" /></strong>
                    <br />
                    <p style={{ width: "250px", wordBreak: "break-all" }}>
                      {invoiceDetails?.billingStreet
                        ? `${invoiceDetails?.billingStreet},${invoiceDetails?.billingCity},`
                        : ""}
                    </p>
                    <p style={{ width: "250px", wordBreak: "break-all" }}>
                      {invoiceDetails?.billingState
                        ? `${invoiceDetails?.billingState},`
                        : ""}
                    </p>
                    <p style={{ width: "250px", wordBreak: "break-all" }}>
                      {`${invoiceDetails?.billingCountry} - ${invoiceDetails?.billingPostalCode}`}
                    </p>
                  </div>
                  <div className="address">
                    <strong><LocalizedText text="Shipping Address" /></strong>
                    <br />
                    <p style={{ width: "250px", wordBreak: "break-all" }}>
                      {invoiceDetails?.shippingStreet
                        ? `${invoiceDetails?.shippingStreet},${invoiceDetails?.shippingCity},`
                        : ""}
                    </p>
                    <p style={{ width: "250px", wordBreak: "break-all" }}>
                      {invoiceDetails?.shippingState
                        ? `${invoiceDetails?.shippingState},`
                        : ""}
                    </p>
                    <p style={{ width: "250px", wordBreak: "break-all" }}>
                      {`${invoiceDetails?.shippingCountry} - ${invoiceDetails?.shippingPostalCode}`}
                    </p>
                  </div>
                </div>
                <table className="invoice-table">
                  <thead>
                    <tr>
                      <th style={{ width: "50px" }}><LocalizedText text="S No" /></th>
                      <th style={{ width: "100px" }}><LocalizedText text="ITEM" /></th>
                      <th style={{ width: "50px" }}><LocalizedText text="QTY" /></th>
                      <th style={{ width: "50px" }}><LocalizedText text="RATE" /></th>
                      <th style={{ width: "50px" }}><LocalizedText text="DISCOUNT" /></th>
                      <th style={{ width: "50px" }}><LocalizedText text="AMOUNT" /></th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceDetails?.items?.length > 0 &&
                      invoiceDetails?.items?.map((item, index) => (
                        <tr key={index}>
                          <td>{item?.id}</td>
                          <td>{item?.productName}</td>
                          <td>{item?.qty}</td>
                          <td>{item?.rate}</td>
                          <td>{`${item?.discountType === "percent" ? `${item?.discount}%` : item?.discountType === "flatAmount" ? `${invoiceDetails?.currency}${item?.discount}` : item?.discountType === "none" ? 0 : ""}`}</td>
                          <td>{item?.amount}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                <div className="totals">
                  <table>
                    <tr>
                      <th style={{ textAlign: "start" }}><LocalizedText text="Total" /></th>
                      <td>:</td>
                      <td
                        style={{ textAlign: "start" }}
                      >{`${invoiceDetails?.currency} ${invoiceDetails?.total || 0}`}</td>
                    </tr>
                    <tr>
                      <th style={{ textAlign: "start" }}><LocalizedText text="Discount" /></th>
                      <td>:</td>
                      <td
                        style={{ textAlign: "start" }}
                      >{`${invoiceDetails?.currency} ${invoiceDetails?.discount || 0}`}</td>
                    </tr>
                    <tr>
                      <th style={{ textAlign: "start" }}><LocalizedText text="Subtotal" /></th>
                      <td>:</td>
                      <td
                        style={{ textAlign: "start" }}
                      >{`${invoiceDetails?.currency} ${invoiceDetails?.subtotal || 0}`}</td>
                    </tr>
                    <tr>
                      <th style={{ textAlign: "start" }}><LocalizedText text="Shipping" /></th>
                      <td>:</td>
                      <td
                        style={{ textAlign: "start" }}
                      >{`${invoiceDetails?.currency} ${invoiceDetails?.shipping || 0}`}</td>
                    </tr>
                    <tr>
                      <th style={{ textAlign: "start" }}><LocalizedText text="Shipping Tax" /></th>
                      <td>:</td>
                      <td
                        style={{ textAlign: "start" }}
                      >{`${invoiceDetails?.currency} ${invoiceDetails?.shippingTax || 0}`}</td>
                    </tr>
                    <tr>
                      <th style={{ textAlign: "start" }}><LocalizedText text="Tax (" />{invoiceDetails?.ptax}%)
                      </th>
                      <td>:</td>
                      <td
                        style={{ textAlign: "start" }}
                      >{`${invoiceDetails?.currency} ${invoiceDetails?.tax || 0}`}</td>
                    </tr>
                    <tr>
                      <th style={{ textAlign: "start" }}><LocalizedText text="Grand Total" /></th>
                      <td>:</td>
                      <td
                        style={{ textAlign: "start" }}
                      >{`${invoiceDetails?.currency} ${invoiceDetails?.grandTotal || 0}`}</td>
                    </tr>
                  </table>
                </div>
                <div className="footer">
                  <div>{invoiceDetails?.description}</div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", justifyContent: "center" }}>
              <Spinner />
            </div>
          )}
        </DrawerBody>
        <DrawerFooter>
          <Button
            sx={{ textTransform: "capitalize" }}
            size="sm"
            disabled={isLoading}
            variant="brand"
            type="submit"
            onClick={generatePDF}
          >
            {isLoading ? <Spinner /> : tr("Download")}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

export default withLocalization(Preview);
