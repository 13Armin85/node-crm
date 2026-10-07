import { isAdmin } from 'roles';
import {
  Avatar,
  Box,
  Button,
  Flex,
  Icon,
  Menu,
  MenuButton,
  MenuDivider,
  MenuItem,
  MenuList,
  Text,
  useColorModeValue,
} from "@chakra-ui/react";
import PropTypes from "prop-types";
import { useCallback, useEffect } from "react";
import {
  FiChevronDown,
  FiHome,
  FiLogOut,
  FiSettings,
  FiUser,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import { useDispatch, useSelector } from "react-redux";
import { LanguageSelect, ThemeToggle } from "components/language/LanguageSelect";
import { useLanguage } from "i18n";
import { clearUser } from "../../redux/slices/localSlice";
import { clearAuthSession, scheduleSessionExpiry } from "services/authSession";
import NotificationsMenu from "./NotificationsMenu";

export default function HeaderLinks() {
  const panelBg = useColorModeValue("white", "#121a2b");
  const textColor = useColorModeValue("#172033", "white");
  const mutedColor = useColorModeValue("gray.500", "gray.400");
  const { t, direction } = useLanguage();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const userData = useSelector((state) => state?.user?.user);
  const data = typeof userData === "string" ? JSON.parse(userData) : userData;
  const storedUser = JSON.parse(localStorage.getItem("user") || "null");
  const loginUser = data || storedUser;
  const userName = [loginUser?.firstName, loginUser?.lastName].filter(Boolean).join(" ") || t("User");
  const userRole = loginUser?.role ? t(loginUser.role) : t("Team member");

  const logOut = useCallback((message) => {
    clearAuthSession();
    dispatch(clearUser());
    navigate("/auth/sign-in", { replace: true });
    message ? toast.error(message) : toast.success(t("Log out Successfully"));
  }, [dispatch, navigate, t]);

  useEffect(() => {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    if (!token) return undefined;

    return scheduleSessionExpiry(token, () => logOut(t("Token has expired")));
  }, [logOut, t]);

  return (
    <Flex className="crm-header-actions" align="center" gap={{ base: "4px", md: "8px" }} dir="ltr">
      <Flex className="crm-header-tools" align="center">
        <ThemeToggle />
        <LanguageSelect compact />
      </Flex>

      <NotificationsMenu userId={loginUser?._id} />

      <Box className="crm-header-divider" />

      <Menu placement="bottom-end" isLazy>
        <MenuButton
          as={Button}
          className="crm-profile-button"
          variant="ghost"
          rightIcon={<FiChevronDown />}
          h="48px"
          px={{ base: "4px", md: "7px" }}
        >
          <Flex align="center" gap="10px" textAlign="start">
            <Avatar name={userName} size="sm" className="crm-profile-avatar" />
            <Box className="crm-profile-meta">
              <Text color={textColor} fontSize="sm" fontWeight="800" lineHeight="1.2" noOfLines={1}>{userName}</Text>
              <Text color={mutedColor} fontSize="11px" lineHeight="1.35" noOfLines={1}>{userRole}</Text>
            </Box>
          </Flex>
        </MenuButton>
        <MenuList className="crm-profile-menu" dir={direction} bg={panelBg} p="8px">
          <Box px="10px" pt="7px" pb="10px">
            <Text fontSize="xs" color={mutedColor}>{t("Signed in as")}</Text>
            <Text fontSize="sm" fontWeight="800" color={textColor}>{userName}</Text>
          </Box>
          <MenuDivider />
          <MenuItem icon={<Icon as={FiHome} />} onClick={() => navigate("/admin/")}>{t("Home")}</MenuItem>
          {isAdmin(loginUser) && (
            <MenuItem icon={<Icon as={FiSettings} />} onClick={() => navigate("/admin-setting")}>{t("Admin Settings")}</MenuItem>
          )}
          <MenuItem icon={<Icon as={FiUser} />} onClick={() => navigate(`/userView/${storedUser?._id}`)}>{t("Profile Settings")}</MenuItem>
          <MenuDivider />
          <MenuItem className="crm-menu-danger" icon={<Icon as={FiLogOut} />} onClick={() => logOut()}>{t("Log out")}</MenuItem>
        </MenuList>
      </Menu>
    </Flex>
  );
}

HeaderLinks.propTypes = {
  variant: PropTypes.string,
  fixed: PropTypes.bool,
  secondary: PropTypes.bool,
  onOpen: PropTypes.func,
};
