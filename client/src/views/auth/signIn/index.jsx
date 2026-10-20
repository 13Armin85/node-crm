import { tr, withLocalization } from 'i18n/runtime';
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useFormik } from "formik";
// Chakra imports
import {
  Box,
  Button,
  Checkbox,
  Flex,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Heading,
  Icon,
  IconButton,
  Input,
  InputGroup,
  InputRightElement,
  Text,
  useColorModeValue,
} from "@chakra-ui/react";

// Custom components
import DefaultAuth from "layouts/auth/Default";
import BrandLogo from "components/BrandLogo";
// Assets

import { MdOutlineRemoveRedEye } from "react-icons/md";
import { RiEyeCloseLine } from "react-icons/ri";
import { postApi } from "services/api";
import { loginSchema } from "schema";
import { toast } from "react-toastify";
import { useDispatch, useSelector } from "react-redux";
import { fetchImage } from "../../../redux/slices/imageSlice";
import { setUser } from "../../../redux/slices/localSlice";
import {
  LanguageSelect,
  ThemeToggle,
} from "components/language/LanguageSelect";
import { useLanguage } from "i18n";

const normalizeLoginValues = (values) => ({
  username: values?.username?.trim()?.toLowerCase(),
  password: values?.password?.trim(),
});

function SignIn() {
  // Chakra color mode
  const textColor = useColorModeValue("navy.700", "white");
  const textColorSecondary = useColorModeValue("gray.500", "whiteAlpha.700");
  const cardBg = useColorModeValue(
    "rgba(255,255,255,0.82)",
    "rgba(13,24,42,0.78)",
  );
  const borderColor = useColorModeValue("blackAlpha.100", "whiteAlpha.200");
  const authCardShadow = useColorModeValue(
    "0 24px 60px rgba(15, 42, 75, 0.12)",
    "0 24px 70px rgba(0, 0, 0, 0.34)",
  );
  const { t } = useLanguage();
  const [isLoding, setIsLoding] = React.useState(false);
  const [checkBox, setCheckBox] = React.useState(true);

  const dispatch = useDispatch();

  useEffect(() => {
    // Load active branding images on component mount.
    dispatch(fetchImage("?isActive=true"));
  }, [dispatch]);

  const image = useSelector((state) => state?.images?.images);

  const [show, setShow] = React.useState(false);
  const showPass = () => setShow(!show);

  const initialValues = {
    username: "",
    password: "",
  };
  const {
    errors,
    values,
    touched,
    handleBlur,
    handleChange,
    resetForm,
    handleSubmit,
  } = useFormik({
    initialValues: initialValues,
    validationSchema: loginSchema,
    onSubmit: (values, { resetForm }) => {
      login();
    },
  });
  const navigate = useNavigate();

  const login = async () => {
    try {
      setIsLoding(true);
      let response = await postApi(
        "api/user/login",
        { ...normalizeLoginValues(values), rememberMe: checkBox },
        checkBox,
      );
      if (response && response?.status === 200) {
        dispatch(setUser(response?.data?.user));
        navigate("/default", { replace: true });
        toast.success(t("Login Successfully!"));
        resetForm();
      } else {
        toast.error(
          response?.data?.error ||
            response?.data?.message ||
            response?.response?.data?.error ||
            t("estate.serverError"),
        );
      }
    } catch (e) {
      console.log(e);
    } finally {
      setIsLoding(false);
    }
  };

  return (
    <DefaultAuth>
      <Box className="crm-login-layout">
        <Flex className="crm-login-controls"><ThemeToggle /><LanguageSelect /></Flex>
        <Box className="crm-login-brand">
          <BrandLogo className="crm-login-logo" />
          <Heading className="crm-login-heading" color={textColor}>{t("Sign In")}</Heading>
          <Text className="crm-login-intro" color={textColorSecondary}>{t("Enter your email and password to sign in!")}</Text>
        </Box>
        <Box className="crm-login-card" bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="20px" boxShadow={authCardShadow} backdropFilter="blur(18px)">
          <Box as="form" className="crm-login-form" onSubmit={handleSubmit} noValidate>
            <FormControl isRequired isInvalid={Boolean(errors?.username && touched?.username)}>
              <FormLabel htmlFor="login-email" fontSize="sm" fontWeight="500" color={textColor}>{t("Email")}</FormLabel>
              <Input id="login-email" name="username" type="email" inputMode="email" autoComplete="username" value={values.username} onChange={handleChange} onBlur={handleBlur} placeholder={tr("mail@company.com")} size="lg" fontWeight="500" />
              <FormErrorMessage>{touched.username && t(errors.username)}</FormErrorMessage>
            </FormControl>
            <FormControl isRequired isInvalid={Boolean(errors?.password && touched?.password)}>
              <FormLabel htmlFor="login-password" fontSize="sm" fontWeight="500" color={textColor}>{t("Password")}</FormLabel>
              <InputGroup>
                <Input id="login-password" name="password" type={show ? "text" : "password"} autoComplete="current-password" value={values.password} onChange={handleChange} onBlur={handleBlur} placeholder={t("Enter Your Password")} size="lg" variant="auth" pe="3rem" />
                <InputRightElement h="100%" w="3rem"><IconButton type="button" aria-label={t(show ? "Hide password" : "Show password")} size="sm" variant="ghost" color={textColorSecondary} icon={<Icon as={show ? RiEyeCloseLine : MdOutlineRemoveRedEye} />} onClick={showPass} /></InputRightElement>
              </InputGroup>
              <FormErrorMessage>{touched.password && t(errors.password)}</FormErrorMessage>
            </FormControl>
            <Checkbox className="crm-login-remember" id="remember-login" isChecked={checkBox} onChange={event => setCheckBox(event.target.checked)} colorScheme="brandScheme" color={textColor}>
              {t("Keep me logged in")}
            </Checkbox>
            <Button className="crm-login-submit" type="submit" variant="brand" w="100%" fontSize="sm" fontWeight="500" isLoading={isLoding} loadingText={t("Sign In")}>{t("Sign In")}</Button>
          </Box>
        </Box>
      </Box>
    </DefaultAuth>
  );
}

export default withLocalization(SignIn);
