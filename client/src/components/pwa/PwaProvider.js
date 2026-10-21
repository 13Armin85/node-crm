import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Box,
  Button,
  Flex,
  Icon,
  IconButton,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import {
  FiDownload,
  FiRefreshCw,
  FiShare,
  FiSmartphone,
  FiWifiOff,
  FiX,
} from "react-icons/fi";
import { useLanguage } from "i18n";
import { registerPwa } from "services/pwa";

const PwaContext = createContext({ installed: false, openInstall: () => {} });
export const usePwa = () => useContext(PwaContext);
export default function PwaProvider({ children }) {
  const { t, language } = useLanguage();
  const dialog = useDisclosure();
  const [prompt, setPrompt] = useState(null);
  const [installed, setInstalled] = useState(
    () =>
      window.matchMedia?.("(display-mode: standalone)").matches ||
      navigator.standalone === true,
  );
  const [offline, setOffline] = useState(navigator.onLine === false);
  const [waiting, setWaiting] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [installFailed, setInstallFailed] = useState(false);
  const reloadRequested = useRef(false);
  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  const secure = window.isSecureContext === true;

  useEffect(() => {
    const offer = (event) => {
      event.preventDefault();
      setPrompt(event);
    };
    const complete = () => {
      setInstalled(true);
      setPrompt(null);
    };
    const connection = () => setOffline(navigator.onLine === false);
    const standalone = window.matchMedia?.("(display-mode: standalone)");
    const display = () =>
      setInstalled(standalone?.matches || navigator.standalone === true);
    const controller = () => {
      if (reloadRequested.current) window.location.reload();
    };
    window.addEventListener("beforeinstallprompt", offer);
    window.addEventListener("appinstalled", complete);
    window.addEventListener("online", connection);
    window.addEventListener("offline", connection);
    standalone?.addEventListener?.("change", display);
    navigator.serviceWorker?.addEventListener("controllerchange", controller);
    const cleanup = registerPwa((worker) => {
      setWaiting(worker);
      setDismissed(false);
    });
    return () => {
      cleanup();
      window.removeEventListener("beforeinstallprompt", offer);
      window.removeEventListener("appinstalled", complete);
      window.removeEventListener("online", connection);
      window.removeEventListener("offline", connection);
      standalone?.removeEventListener?.("change", display);
      navigator.serviceWorker?.removeEventListener(
        "controllerchange",
        controller,
      );
    };
  }, []);
  const install = async () => {
    if (!prompt || busy) return;
    setBusy(true);
    setInstallFailed(false);
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      setPrompt(null);
      if (choice?.outcome === "accepted") dialog.onClose();
    } catch {
      setPrompt(null);
      setInstallFailed(true);
    } finally {
      setBusy(false);
    }
  };
  const update = () => {
    if (!waiting || updating) return;
    reloadRequested.current = true;
    setUpdating(true);
    if (waiting.state === "activated") window.location.reload();
    else waiting.postMessage({ type: "SKIP_WAITING" });
  };
  return (
    <PwaContext.Provider value={{ installed, openInstall: dialog.onOpen }}>
      {children}
      {(offline || (waiting && !dismissed)) && (
        <Flex
          className="crm-pwa-status"
          role="status"
          dir={language === "fa" ? "rtl" : "ltr"}
        >
          <Icon
            as={offline ? FiWifiOff : FiRefreshCw}
            boxSize={5}
            flexShrink={0}
          />
          <Box flex="1" minW={0}>
            <Text fontWeight="800">
              {t(offline ? "pwa.offline" : "pwa.updateReady")}
            </Text>
            <Text fontSize="xs">
              {t(offline ? "pwa.onlineRequired" : "pwa.saveBeforeUpdate")}
            </Text>
          </Box>
          {!offline && (
            <Flex gap={2}>
              <Button
                size="sm"
                colorScheme="blue"
                onClick={update}
                isLoading={updating}
              >
                {t("pwa.update")}
              </Button>
              <IconButton
                size="sm"
                variant="ghost"
                icon={<FiX />}
                aria-label={t("pwa.later")}
                onClick={() => setDismissed(true)}
              />
            </Flex>
          )}
        </Flex>
      )}
      <Modal
        isOpen={dialog.isOpen}
        onClose={dialog.onClose}
        isCentered
        scrollBehavior="inside"
      >
        <ModalOverlay />
        <ModalContent
          className="crm-pwa-install"
          dir={language === "fa" ? "rtl" : "ltr"}
        >
          <ModalHeader paddingInlineEnd="48px">
            {t("pwa.installTitle")}
          </ModalHeader>
          <ModalCloseButton aria-label={t("Close")} />
          <ModalBody>
            <Flex className="crm-pwa-install-icon">
              <Icon as={FiSmartphone} boxSize={8} />
            </Flex>
            <Text fontWeight="700" mb={3}>
              {t("pwa.installDescription")}
            </Text>
            {installed ? (
              <Text>{t("pwa.installed")}</Text>
            ) : !secure ? (
              <Text role="status">{t("pwa.httpsRequired")}</Text>
            ) : ios ? (
              <Box as="ol" className="crm-pwa-steps">
                <li>{t("pwa.iosSafari")}</li>
                <li>
                  <Icon as={FiShare} /> {t("pwa.iosShare")}
                </li>
                <li>{t("pwa.addToHome")}</li>
              </Box>
            ) : !prompt ? (
              <Text>{t("pwa.browserMenu")}</Text>
            ) : (
              <Text>{t("pwa.ready")}</Text>
            )}
            <Text fontSize="sm" color="var(--crm-muted)" mt={4}>
              {t("pwa.onlineRequired")}
            </Text>
            {installFailed && (
              <Text color="red.500" role="alert" mt={3}>
                {t("pwa.installFailed")}
              </Text>
            )}
          </ModalBody>
          <ModalFooter gap={2} flexWrap="wrap">
            <Button variant="ghost" onClick={dialog.onClose}>
              {t("Close")}
            </Button>
            {!installed && secure && prompt && (
              <Button
                colorScheme="blue"
                leftIcon={<FiDownload />}
                isLoading={busy}
                onClick={install}
              >
                {t("pwa.install")}
              </Button>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>
    </PwaContext.Provider>
  );
}
