import { useState } from 'react';
import { Box, Input, Select, Text } from '@chakra-ui/react';
import { useLanguage } from 'i18n';
import { matchesAssignee, userDisplayName } from 'services/taskSearch';

export default function AssigneeSelect({ assignees = [], value, onChange, isDisabled, searchable = true, ...props }) {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const matches = searchable ? assignees.filter(user => matchesAssignee(user, query)) : assignees;
  const selected = assignees.find(user => String(user._id) === String(value));
  const options = selected && !matches.includes(selected) ? [selected, ...matches] : matches;
  return <Box minW={0} onMouseDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>
    {searchable && <Input
      size={props.size || 'sm'}
      mb={1}
      value={query}
      isDisabled={isDisabled}
      placeholder={t('Search names...')}
      aria-label={t('Search names...')}
      autoComplete="off"
      onChange={event => setQuery(event.target.value)}
    />}
    <Select {...props} aria-label={t('Assigned User')} value={value || ''} isDisabled={isDisabled}
      onChange={event => { onChange(event); setQuery(''); }}>
      {!props.placeholder && <option value="" disabled>{t('Select user')}</option>}
      {options.map(user => <option key={user._id} value={user._id}>{userDisplayName(user)}</option>)}
    </Select>
    {searchable && query.trim() && !matches.length && <Text role="status" fontSize="xs" color="gray.500" mt={1}>{t('No Data Found')}</Text>}
  </Box>;
}
