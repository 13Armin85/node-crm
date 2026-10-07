import { safeInternalPath } from 'services/contentSecurity';
import { Badge, Box, Button, Flex, IconButton, Menu, MenuButton, MenuItem, MenuList, Spinner, Text, useColorModeValue } from '@chakra-ui/react';
import { FiBell } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useLanguage } from 'i18n';
import useNotifications from './useNotifications';

export const notificationTitles = {
  task_assigned: 'Task assigned to you',
  task_status_changed: 'Task status changed',
  task_updated: 'Task updated',
  task_unassigned: 'Task assignment removed',
  task_deleted: 'Task deleted',
  record_created: 'Record created',
  record_updated: 'Record updated',
  record_deleted: 'Record deleted',
  record_status_changed: 'Record status changed',
  record_assigned: 'Record assigned to you',
  property_sold: 'Property marked as sold',
  account_created: 'Your account was created',
  account_updated: 'Your account was updated',
  role_changed: 'Your role was changed',
  document_uploaded: 'Document uploaded',
  document_linked: 'Document linked',
};

export default function NotificationsMenu({ userId }) {
  const { t, language, direction } = useLanguage();
  const navigate = useNavigate();
  const textColor = useColorModeValue('#172033', 'white');
  const mutedColor = useColorModeValue('gray.500', 'gray.400');
  const { notifications, unreadCount, hasMore, loading, loadingMore, updating, error, refresh, loadMore, markRead, markAllRead } = useNotifications(userId);
  const locale = language === 'fa' ? 'fa-IR' : language === 'tr' ? 'tr-TR' : 'en-US';

  const open = async notification => {
    const success = await markRead(notification);
    if (!success) toast.error(t('Failed to update notifications'));
    const link = notification.link;
    navigate(safeInternalPath(link));
  };

  return (
    <Menu placement="bottom-end" isLazy onOpen={refresh}>
      <MenuButton
        as={IconButton}
        className="crm-header-icon-button"
        aria-label={t('Notifications')}
        icon={<Box position="relative" display="flex">
          <FiBell />
          {unreadCount > 0 && <Badge className="crm-notifications-count" aria-label={unreadCount + ' ' + t('unread')}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>}
        </Box>}
        variant="ghost"
      />
      <MenuList className="crm-notifications-menu" dir={direction} p="10px">
        <Flex align="center" justify="space-between" px="8px" py="6px">
          <Text fontSize="sm" fontWeight="800" color={textColor}>{t('Notifications')}</Text>
          <Flex align="center" gap="8px">
            {unreadCount > 0 && <Button size="xs" variant="link" isLoading={updating} onClick={markAllRead}>{t('Mark all read')}</Button>}
            {!error && !loading && <Box className="crm-live-badge">{t('Live')}</Box>}
          </Flex>
        </Flex>
        {error && <Flex role="alert" direction="column" gap="6px" px="8px" py="10px">
          <Text fontSize="xs" color="red.500">{t(error)}</Text>
          <Button size="xs" alignSelf="start" onClick={refresh}>{t('Retry')}</Button>
        </Flex>}
        {loading ? <Flex justify="center" p="24px"><Spinner size="sm" label={t('Loading notifications')} /></Flex>
          : notifications.length === 0 && !error ? <Flex className="crm-notifications-empty" direction="column" align="center" justify="center">
            <Flex className="crm-notifications-empty__icon" align="center" justify="center"><FiBell /></Flex>
            <Text fontWeight="700" fontSize="sm">{t('You are all caught up')}</Text>
            <Text color={mutedColor} fontSize="xs" textAlign="center">{t('New activity will appear here')}</Text>
          </Flex> : <Box className="crm-notifications-list">
            {notifications.map(notification => {
              const actorName = [notification.actor?.firstName, notification.actor?.lastName].filter(Boolean).join(' ') || notification.actor?.username;
              const date = new Date(notification.createdAt);
              return <MenuItem key={notification._id} className={'crm-notification-item' + (notification.readAt ? '' : ' is-unread')} isDisabled={updating} onClick={() => open(notification)}>
                <Flex direction="column" gap="3px" minW={0} flex="1">
                  <Text fontSize="sm" fontWeight={notification.readAt ? '600' : '800'} noOfLines={1}>{t(notificationTitles[notification.type] || 'New activity')}</Text>
                  {notification.module && <Text fontSize="10px" color={mutedColor}>{t(notification.module)}</Text>}
                  <Text fontSize="xs" color={mutedColor} noOfLines={2}>{notification.message}{notification.status ? ' · ' + t(notification.status) : ''}</Text>
                  <Text fontSize="10px" color={mutedColor} noOfLines={1}>
                    {actorName ? t('By') + ' ' + actorName + ' · ' : ''}
                    {Number.isNaN(date.getTime()) ? '' : date.toLocaleString(locale)}
                  </Text>
                </Flex>
                {!notification.readAt && <Box className="crm-notification-dot" />}
              </MenuItem>;
            })}
            {hasMore && <Flex justify="center" py="8px">
              <Button size="xs" variant="ghost" isLoading={loadingMore} isDisabled={updating} onClick={loadMore}>{t('Load older notifications')}</Button>
            </Flex>}
          </Box>}
      </MenuList>
    </Menu>
  );
}
