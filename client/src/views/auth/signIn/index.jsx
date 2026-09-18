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
  HStack,
  Heading,
  Icon,
  Input,
  InputGroup,
  InputRightElement,
  Text,
  useColorModeValue,
} from "@chakra-ui/react";

// Custom components
import DefaultAuth from "layouts/auth/Default";
// Assets

import { MdOutlineRemoveRedEye } from "react-icons/md";
import { RiEyeCloseLine } from "react-icons/ri";
import { postApi } from "services/api";
import { loginSchema } from "schema";
import { toast } from "react-toastify";
import Spinner from "components/spinner/Spinner";
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
  const brandStars = useColorModeValue("brand.500", "brand.400");
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
        normalizeLoginValues(values),
        checkBox,
      );
      if (response && response?.status === 200) {
        navigate("/default");
        toast.success(t("Login Successfully!"));
        resetForm();
        dispatch(setUser(response?.data?.user));
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
    <DefaultAuth
      illustrationBackground={image?.length > 0 && image[0]?.authImg}
      image={image?.length > 0 && image[0]?.authImg}
    >
      <Flex
        maxW="100%"
        w="100%"
        mx="auto"
        h="auto"
        alignItems="center"
        justifyContent="center"
        mb="0"
        px="0"
        mt="0"
        flexDirection="column"
      >
        <HStack w="100%" justify="flex-end" mb="28px" spacing="8px">
          <ThemeToggle />
          <LanguageSelect />
        </HStack>
        <Box w="100%" textAlign="center">
          <Heading color={textColor} fontSize="36px" mb="10px">
            {t("Sign In")}
          </Heading>
          <Text
            mb="36px"
            ms="0"
            color={textColorSecondary}
            fontWeight="400"
            fontSize="md"
          >
            {t("Enter your email and password to sign in!")}
          </Text>
        </Box>
        <Flex
          zIndex="2"
          direction="column"
          w={{ base: "100%", md: "420px" }}
          maxW="100%"
          background={cardBg}
          border="1px solid"
          borderColor={borderColor}
          borderRadius="20px"
          boxShadow={authCardShadow}
          backdropFilter="blur(18px)"
          p={{ base: "22px", md: "28px" }}
          mx="auto"
          me="auto"
          mb="0"
        >
          <form onSubmit={handleSubmit}>
            <FormControl isInvalid={errors?.username && touched?.username}>
              <FormLabel
                display="flex"
                ms="4px"
                fontSize="sm"
                fontWeight="500"
                color={textColor}
                mb="8px"
              >
                {t("Email")}
                <Text color={brandStars}>*</Text>
              </FormLabel>
              <Input
                fontSize="sm"
                onChange={handleChange}
                onBlur={handleBlur}
                value={values?.username}
                name="username"
                ms={{ base: "0px", md: "0px" }}
                type="email"
                placeholder={tr("mail@company.com")}
                mb={errors?.username && touched?.username ? undefined : "24px"}
                fontWeight="500"
                size="lg"
                borderColor={
                  errors?.username && touched?.username ? "red.300" : null
                }
                className={
                  errors?.username && touched?.username ? "isInvalid" : null
                }
              />
              {errors?.username && touched?.username && (
                <FormErrorMessage mb="24px">
                  {" "}
                  {t(errors?.username)}
                </FormErrorMessage>
              )}
            </FormControl>

            <FormControl
              isInvalid={errors?.password && touched?.password}
              mb="24px"
            >
              <FormLabel
                ms="4px"
                fontSize="sm"
                fontWeight="500"
                color={textColor}
                display="flex"
              >
                {t("Password")}
                <Text color={brandStars}>*</Text>
              </FormLabel>
              <InputGroup size="md">
                <Input
                  isRequired={true}
                  fontSize="sm"
                  placeholder={t("Enter Your Password")}
                  name="password"
                  mb={
                    errors?.password && touched?.password ? undefined : "24px"
                  }
                  value={values?.password}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  size="lg"
                  variant="auth"
                  type={show ? "text" : "password"}
                  borderColor={
                    errors?.password && touched?.password ? "red.300" : null
                  }
                  className={
                    errors?.password && touched?.password ? "isInvalid" : null
                  }
                />
                <InputRightElement display="flex" alignItems="center" mt="4px">
                  <Icon
                    color={textColorSecondary}
                    _hover={{ cursor: "pointer" }}
                    as={show ? RiEyeCloseLine : MdOutlineRemoveRedEye}
                    onClick={showPass}
                  />
                </InputRightElement>
              </InputGroup>
              {errors?.password && touched?.password && (
                <FormErrorMessage mb="24px">
                  {" "}
                  {t(errors?.password)}
                </FormErrorMessage>
              )}
              <Flex justifyContent="space-between" align="center" mb="24px">
                <FormControl display="flex" alignItems="center">
                  <Checkbox
                    onChange={(e) => setCheckBox(e?.target?.checked)}
                    id="remember-login"
                    value={checkBox}
                    defaultChecked
                    colorScheme="brandScheme"
                    me="10px"
                  />
                  <FormLabel
                    htmlFor="remember-login"
                    mb="0"
                    fontWeight="normal"
                    color={textColor}
                    fontSize="sm"
                  >
                    {t("Keep me logged in")}
                  </FormLabel>
                </FormControl>
              </Flex>

              <Flex
                justifyContent="space-between"
                align="center"
                mb="24px"
              ></Flex>
              <Button
                fontSize="sm"
                variant="brand"
                fontWeight="500"
                w="100%"
                h="50"
                type="submit"
                mb="24px"
                disabled={isLoding ? true : false}
              >
                {isLoding ? <Spinner /> : t("Sign In")}
              </Button>
            </FormControl>
          </form>
        </Flex>
      </Flex>
    </DefaultAuth>
  );
}

export default withLocalization(SignIn);
