import React, { useEffect, useState } from 'react';
import {
  Alert, AlertIcon, Badge, Box, Button, Checkbox, Flex, FormControl,
  FormLabel, Grid, GridItem, Icon, IconButton, Input, Select, SimpleGrid,
  Skeleton, Stack, Text, Tooltip, useColorModeValue,
} from '@chakra-ui/react';
import {
  MdAdd, MdArrowDownward, MdArrowUpward, MdCheckCircle, MdDeleteOutline,
  MdDragIndicator, MdInfoOutline, MdLockOutline, MdOutlineDynamicForm,
  MdOutlineSettings, MdSave, MdTranslate, MdViewList,
} from 'react-icons/md';
import Card from 'components/card/Card';
import { getApi, putApi } from 'services/api';
import { useLanguage } from 'i18n';
import { localized } from 'components/dynamicForm/DynamicFormRenderer';

const types = ['text', 'textarea', 'number', 'currency', 'select', 'multiselect', 'checkbox', 'radio', 'date', 'datetime', 'email', 'phone', 'file', 'url'];
const languages = ['en', 'fa', 'tr'];
const emptyLocalized = () => ({ en: '', fa: '', tr: '' });

function Section({ icon, title, description, children }) {
  const border = useColorModeValue('gray.200', 'whiteAlpha.200');
  const muted = useColorModeValue('gray.500', 'gray.400');
  const iconBg = useColorModeValue('brand.50', 'whiteAlpha.100');
  const headingBg = useColorModeValue('gray.50', 'whiteAlpha.50');
  return (
    <Box border="1px solid" borderColor={border} borderRadius="18px" overflow="hidden">
      <Flex align="center" gap="12px" px={{ base: 4, md: 5 }} py="14px" bg={headingBg}>
        <Flex align="center" justify="center" boxSize="38px" borderRadius="12px" bg={iconBg} color="brand.500" flexShrink={0}>
          <Icon as={icon} boxSize="20px" />
        </Flex>
        <Box minW="0">
          <Text fontWeight="800" fontSize="sm">{title}</Text>
          {description && <Text color={muted} fontSize="xs" mt="2px">{description}</Text>}
        </Box>
      </Flex>
      <Box p={{ base: 4, md: 5 }}>{children}</Box>
    </Box>
  );
}

export default function FormBuilder() {
  const { t, language } = useLanguage();
  const [modules, setModules] = useState([]);
  const [moduleName, setModuleName] = useState('Properties');
  const [definition, setDefinition] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [selected, setSelected] = useState(0);
  const [savedNames, setSavedNames] = useState([]);
  const [changed, setChanged] = useState(false);
  const admin = JSON.parse(localStorage.getItem('user') || '{}').role === 'superAdmin';
  const panelBg = useColorModeValue('white', 'navy.800');
  const subtleBg = useColorModeValue('gray.50', 'whiteAlpha.50');
  const border = useColorModeValue('gray.200', 'whiteAlpha.200');
  const muted = useColorModeValue('gray.500', 'gray.400');
  const activeBg = useColorModeValue('brand.50', 'whiteAlpha.100');

  useEffect(() => {
    getApi('api/estate/definitions').then(response => {
      if (response.status === 200) setModules(response.data);
      else setError('serverError');
    });
  }, []);

  useEffect(() => {
    let active = true;
    setDefinition(null); setError(''); setSuccess(false); setChanged(false);
    getApi(`api/estate/definitions/${encodeURIComponent(moduleName)}`).then(response => {
      if (!active) return;
      if (response.status === 200) {
        setDefinition(response.data);
        setSavedNames(response.data.fields.map(item => item.name));
        setSelected(0);
      } else setError(response.data?.code || 'serverError');
    });
    return () => { active = false; };
  }, [moduleName]);

  if (!admin) return <Alert status="error" mt="100px"><AlertIcon />{t('estate.forbidden')}</Alert>;

  const field = definition?.fields[selected];
  const fieldCount = definition?.fields?.length || 0;
  const customCount = definition?.fields?.filter(item => item.kind === 'CUSTOM_FIELD').length || 0;
  const enabledCount = definition?.fields?.filter(item => item.enabled !== false).length || 0;

  const update = patch => {
    setDefinition(current => ({ ...current, fields: current.fields.map((item, index) => index === selected ? { ...item, ...patch } : item) }));
    setChanged(true); setSuccess(false);
  };

  const add = () => {
    const next = { name: `field_${Date.now()}`, kind: 'CUSTOM_FIELD', type: 'text', label: emptyLocalized(), enabled: true, required: false, options: [], order: definition.fields.length };
    setDefinition(current => ({ ...current, fields: [...current.fields, next] }));
    setSelected(definition.fields.length); setChanged(true); setSuccess(false);
  };

  const move = delta => {
    const fields = [...definition.fields]; const target = selected + delta;
    if (target < 0 || target >= fields.length) return;
    [fields[selected], fields[target]] = [fields[target], fields[selected]];
    setDefinition({ ...definition, fields: fields.map((item, order) => ({ ...item, order })) });
    setSelected(target); setChanged(true); setSuccess(false);
  };

  const remove = () => {
    const fields = definition.fields.filter((_, index) => index !== selected).map((item, order) => ({ ...item, order }));
    setDefinition({ ...definition, fields });
    setSelected(Math.max(0, Math.min(selected - 1, fields.length - 1)));
    setChanged(true); setSuccess(false);
  };

  const save = async () => {
    setBusy(true); setError(''); setSuccess(false);
    const result = await putApi(`api/estate/definitions/${encodeURIComponent(moduleName)}`, definition);
    if (result.status === 200) {
      setDefinition(result.data); setSavedNames(result.data.fields.map(item => item.name));
      setChanged(false); setSuccess(true);
    } else setError(result.data?.code || 'serverError');
    setBusy(false);
  };

  const updateOption = (optionIndex, patch) => update({ options: field.options.map((option, index) => index === optionIndex ? { ...option, ...patch } : option) });

  const localizedEditor = key => (
    <Box key={key}>
      <Text fontWeight="700" fontSize="sm" mb="10px">{t(`estate.${key}`)}</Text>
      <SimpleGrid columns={{ base: 1, md: 3 }} spacing="12px">
        {languages.map(lang => (
          <FormControl key={lang}>
            <FormLabel color={muted} fontSize="xs" mb="6px">{t(`estate.language.${lang}`)}</FormLabel>
            <Input dir="ltr" value={field[key]?.[lang] || ''} onChange={event => update({ [key]: { ...emptyLocalized(), ...field[key], [lang]: event.target.value } })} borderRadius="12px" bg={panelBg} />
          </FormControl>
        ))}
      </SimpleGrid>
    </Box>
  );

  return (
    <Box className="form-builder-page" data-testid="form-builder" pb="30px" dir="ltr">
      <Box borderRadius="22px" p={{ base: 5, md: 7 }} mb="20px" color="white" bg="linear-gradient(120deg, #4318FF 0%, #7551FF 52%, #00C6FF 130%)" boxShadow="0 18px 45px rgba(67, 24, 255, 0.22)" position="relative" overflow="hidden">
        <Box position="absolute" boxSize="230px" borderRadius="full" bg="whiteAlpha.100" right="-70px" top="-130px" />
        <Flex direction={{ base: 'column', md: 'row' }} justify="space-between" align={{ base: 'stretch', md: 'center' }} gap="20px" position="relative">
          <Flex align="center" gap="16px">
            <Flex boxSize={{ base: '52px', md: '62px' }} borderRadius="18px" bg="whiteAlpha.200" align="center" justify="center" flexShrink={0}><Icon as={MdOutlineDynamicForm} boxSize={{ base: '28px', md: '34px' }} /></Flex>
            <Box><Text color="white" fontSize={{ base: 'xl', md: '2xl' }} fontWeight="900">{t('estate.formBuilder')}</Text><Text mt="5px" color="whiteAlpha.800" fontSize="sm">{t('estate.formBuilderDescription')}</Text></Box>
          </Flex>
          <FormControl maxW={{ base: '100%', md: '300px' }}>
            <FormLabel fontSize="xs" color="whiteAlpha.800" mb="6px">{t('estate.selectModule')}</FormLabel>
            <Select data-testid="module-select" aria-label={t('Module')} value={moduleName} onChange={event => setModuleName(event.target.value)} bg="white" color="navy.700" border="0" borderRadius="14px" fontWeight="700" h="46px">
              {modules.map(name => <option key={name} value={name}>{t(name)}</option>)}
            </Select>
          </FormControl>
        </Flex>
      </Box>

      {(error || success) && <Alert status={error ? 'error' : 'success'} borderRadius="14px" mb="20px"><AlertIcon />{error ? t(`estate.${error}`) : t('estate.savedSuccessfully')}</Alert>}

      {!definition ? (
        <Grid templateColumns={{ base: '1fr', lg: '320px minmax(0, 1fr)' }} gap="20px"><Skeleton height="520px" borderRadius="20px" /><Skeleton height="520px" borderRadius="20px" /></Grid>
      ) : (
        <>
          <SimpleGrid columns={{ base: 1, sm: 3 }} spacing="12px" mb="20px">
            {[[MdViewList, t('estate.totalFields'), fieldCount], [MdAdd, t('estate.customFieldsCount'), customCount], [MdCheckCircle, t('estate.activeFields'), enabledCount]].map(([icon, label, value]) => (
              <Flex key={label} bg={panelBg} border="1px solid" borderColor={border} borderRadius="16px" p="14px" align="center" gap="12px">
                <Flex boxSize="40px" borderRadius="12px" bg={activeBg} color="brand.500" align="center" justify="center"><Icon as={icon} boxSize="20px" /></Flex>
                <Box><Text color={muted} fontSize="xs">{label}</Text><Text fontSize="xl" fontWeight="900">{value}</Text></Box>
              </Flex>
            ))}
          </SimpleGrid>

          <Grid templateColumns={{ base: 'minmax(0, 1fr)', lg: '320px minmax(0, 1fr)' }} gap="20px" alignItems="start">
            <GridItem>
              <Card data-testid="fields-panel" p="0" overflow="hidden" border="1px solid" borderColor={border} borderRadius="20px">
                <Flex px="18px" py="16px" align="center" justify="space-between" borderBottom="1px solid" borderColor={border}>
                  <Box><Text fontWeight="900">{t('estate.fieldsList')}</Text><Text color={muted} fontSize="xs" mt="2px">{t('estate.fieldsListHint')}</Text></Box>
                  <Tooltip label={t('estate.addField')}><IconButton data-testid="add-field" aria-label={t('estate.addField')} icon={<MdAdd />} colorScheme="brand" borderRadius="12px" onClick={add} /></Tooltip>
                </Flex>
                <Stack spacing="7px" p="10px" maxH={{ base: '360px', lg: 'calc(100vh - 310px)' }} overflowY="auto">
                  {definition.fields.map((item, index) => {
                    const isActive = selected === index;
                    return (
                      <Button key={item.name} h="auto" minH="58px" px="10px" py="9px" variant="ghost" bg={isActive ? activeBg : 'transparent'} color={isActive ? 'brand.500' : 'inherit'} border="1px solid" borderColor={isActive ? 'brand.200' : 'transparent'} borderRadius="14px" justifyContent="stretch" onClick={() => setSelected(index)} _hover={{ bg: activeBg }}>
                        <Icon as={MdDragIndicator} color={isActive ? 'brand.400' : muted} boxSize="20px" flexShrink={0} />
                        <Box textAlign="left" mx="9px" minW="0" flex="1"><Text fontSize="sm" fontWeight="800" noOfLines={1}>{localized(item.label, language) || t('estate.newField')}</Text><Text color={muted} fontSize="10px" mt="3px" fontWeight="600">{t(`estate.type.${item.type}`)}</Text></Box>
                        {item.kind === 'SYSTEM_FIELD' && <Icon as={MdLockOutline} color={muted} boxSize="15px" />}
                      </Button>
                    );
                  })}
                </Stack>
              </Card>
            </GridItem>

            {field && (
              <GridItem minW="0">
                <Card data-testid="field-editor" p="0" border="1px solid" borderColor={border} borderRadius="20px" overflow="hidden">
                  <Flex px={{ base: 4, md: 5 }} py="15px" borderBottom="1px solid" borderColor={border} align={{ base: 'flex-start', sm: 'center' }} justify="space-between" direction={{ base: 'column', sm: 'row' }} gap="12px">
                    <Box minW="0">
                      <Flex align="center" gap="8px" flexWrap="wrap"><Text fontWeight="900" fontSize="lg" noOfLines={1}>{localized(field.label, language) || t('estate.newField')}</Text><Badge colorScheme={field.kind === 'SYSTEM_FIELD' ? 'purple' : 'green'} borderRadius="full" px="9px" py="3px">{t(field.kind === 'SYSTEM_FIELD' ? 'estate.systemField' : 'estate.customField')}</Badge></Flex>
                      <Text color={muted} fontSize="xs" mt="4px">{field.name}</Text>
                    </Box>
                    <Flex gap="6px" flexShrink={0}>
                      <Tooltip label={t('estate.moveUp')}><IconButton aria-label={t('estate.moveUp')} icon={<MdArrowUpward />} isDisabled={selected === 0} onClick={() => move(-1)} variant="outline" borderRadius="11px" /></Tooltip>
                      <Tooltip label={t('estate.moveDown')}><IconButton aria-label={t('estate.moveDown')} icon={<MdArrowDownward />} isDisabled={selected === definition.fields.length - 1} onClick={() => move(1)} variant="outline" borderRadius="11px" /></Tooltip>
                      {field.kind === 'CUSTOM_FIELD' && <Tooltip label={t('Delete')}><IconButton aria-label={t('Delete')} icon={<MdDeleteOutline />} onClick={remove} colorScheme="red" variant="ghost" borderRadius="11px" /></Tooltip>}
                    </Flex>
                  </Flex>

                  <Stack spacing="18px" p={{ base: 4, md: 5 }} bg={subtleBg}>
                    <Section icon={MdOutlineSettings} title={t('estate.fieldSettings')} description={t('estate.fieldSettingsHint')}>
                      <SimpleGrid columns={{ base: 1, md: 2 }} spacing="18px">
                        <FormControl><FormLabel fontSize="sm">{t('Type')}</FormLabel><Select value={field.type} isDisabled={field.kind === 'SYSTEM_FIELD' || savedNames.includes(field.name)} onChange={event => update({ type: event.target.value, defaultValue: undefined })} borderRadius="12px" bg={panelBg}>{types.map(type => <option key={type} value={type}>{t(`estate.type.${type}`)}</option>)}</Select></FormControl>
                        <Box><Text fontWeight="700" fontSize="sm" mb="12px">{t('estate.fieldBehavior')}</Text><Flex gap="18px" minH="40px" align="center" flexWrap="wrap"><Checkbox isChecked={field.enabled !== false} isDisabled={field.locked} onChange={event => update({ enabled: event.target.checked })}>{t('estate.enabled')}</Checkbox><Checkbox isChecked={Boolean(field.required)} isDisabled={field.locked} onChange={event => update({ required: event.target.checked })}>{t('estate.required')}</Checkbox></Flex></Box>
                      </SimpleGrid>
                      {(field.locked || savedNames.includes(field.name)) && <Flex mt="14px" gap="8px" color={muted} fontSize="xs" align="center"><Icon as={MdInfoOutline} /><Text>{t('estate.protectedFieldHint')}</Text></Flex>}
                    </Section>

                    <Section icon={MdTranslate} title={t('estate.translations')} description={t('estate.translationsHint')}><Stack spacing="18px">{['label', 'placeholder', 'helpText', 'validationMessage'].map(localizedEditor)}</Stack></Section>

                    <Section icon={MdOutlineDynamicForm} title={t('estate.defaultAndValidation')} description={t('estate.defaultAndValidationHint')}>
                      <FormControl><FormLabel fontSize="sm">{t('estate.defaultValue')}</FormLabel>
                        {field.type === 'checkbox' ? <Checkbox isChecked={Boolean(field.defaultValue)} onChange={event => update({ defaultValue: event.target.checked })}>{t('estate.defaultChecked')}</Checkbox>
                          : ['multiselect', 'file'].includes(field.type) ? <Flex bg={subtleBg} borderRadius="12px" p="12px" color={muted} align="center" gap="8px"><Icon as={MdInfoOutline} /><Text fontSize="sm">{t('estate.defaultEmpty')}</Text></Flex>
                          : <Input value={field.defaultValue ?? ''} type={['number', 'currency'].includes(field.type) ? 'number' : 'text'} onChange={event => update({ defaultValue: event.target.value === '' ? undefined : ['number', 'currency'].includes(field.type) ? Number(event.target.value) : event.target.value })} borderRadius="12px" bg={panelBg} />}
                      </FormControl>
                      {['number', 'currency'].includes(field.type) && field.kind === 'CUSTOM_FIELD' && <SimpleGrid columns={{ base: 1, sm: 2 }} spacing="14px" mt="16px">{['min', 'max'].map(key => <FormControl key={key}><FormLabel fontSize="sm">{t(`estate.${key}`)}</FormLabel><Input type="number" value={field[key] ?? ''} onChange={event => update({ [key]: event.target.value === '' ? undefined : Number(event.target.value) })} borderRadius="12px" bg={panelBg} /></FormControl>)}</SimpleGrid>}
                    </Section>

                    {['select', 'radio', 'multiselect'].includes(field.type) && !field.relation && (
                      <Section icon={MdViewList} title={t('estate.options')} description={t('estate.optionsHint')}>
                        <Stack spacing="12px">
                          {(field.options || []).map((option, optionIndex) => (
                            <Box border="1px solid" borderColor={border} borderRadius="15px" p="14px" key={`${option.value}-${optionIndex}`} bg={panelBg}>
                              <Flex align="center" justify="space-between" mb="12px"><Text fontWeight="800" fontSize="sm">{t('estate.option')} {optionIndex + 1}</Text>{field.kind === 'CUSTOM_FIELD' && <IconButton size="sm" aria-label={t('Delete')} icon={<MdDeleteOutline />} colorScheme="red" variant="ghost" onClick={() => update({ options: field.options.filter((_, index) => index !== optionIndex) })} />}</Flex>
                              <FormControl mb="12px"><FormLabel color={muted} fontSize="xs">{t('estate.optionValue')}</FormLabel><Input value={option.value} isDisabled={field.kind === 'SYSTEM_FIELD'} onChange={event => updateOption(optionIndex, { value: event.target.value })} borderRadius="12px" /></FormControl>
                              <SimpleGrid columns={{ base: 1, md: 3 }} spacing="10px">{languages.map(lang => <FormControl key={lang}><FormLabel color={muted} fontSize="xs">{t(`estate.language.${lang}`)}</FormLabel><Input dir="ltr" value={option.label?.[lang] || ''} onChange={event => updateOption(optionIndex, { label: { ...option.label, [lang]: event.target.value } })} borderRadius="12px" /></FormControl>)}</SimpleGrid>
                            </Box>
                          ))}
                          {field.kind === 'CUSTOM_FIELD' && <Button leftIcon={<MdAdd />} onClick={() => update({ options: [...(field.options || []), { value: '', label: emptyLocalized() }] })} variant="outline" borderStyle="dashed" borderRadius="13px" minH="46px">{t('estate.addOption')}</Button>}
                        </Stack>
                      </Section>
                    )}
                  </Stack>

                  <Flex position="sticky" bottom="0" zIndex="2" px={{ base: 4, md: 5 }} py="14px" bg={panelBg} borderTop="1px solid" borderColor={border} justify="space-between" align="center" gap="12px">
                    <Flex align="center" gap="7px" color={changed ? 'orange.400' : 'green.400'} minW="0"><Icon as={changed ? MdInfoOutline : MdCheckCircle} flexShrink={0} /><Text fontSize="xs" fontWeight="700" noOfLines={1}>{t(changed ? 'estate.unsavedChanges' : 'estate.allChangesSaved')}</Text></Flex>
                    <Button data-testid="save-form" leftIcon={<MdSave />} variant="brand" isLoading={busy} isDisabled={!changed} onClick={save} borderRadius="12px" px={{ base: 4, md: 7 }} flexShrink={0}>{t('Save')}</Button>
                  </Flex>
                </Card>
              </GridItem>
            )}
          </Grid>
        </>
      )}
    </Box>
  );
}
