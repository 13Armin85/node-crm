import { Avatar } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { getApiBlob } from 'services/api';
import { formLabel } from 'utils/formValue';
const images = new Map();
export default function ProfileAvatar({ user, ...props }) {
  const [src, setSrc] = useState('');
  const id = user?._id, version = user?.avatarVersion;
  useEffect(() => {
    let active = true; setSrc('');
    if (!id || !version) return undefined;
    const key = id + ':' + version;
    if (!images.has(key)) images.set(key, getApiBlob(`api/profile/${id}/avatar?v=${encodeURIComponent(version)}`).then(result => result?.status === 200 ? URL.createObjectURL(result.data) : '').catch(() => ''));
    images.get(key).then(value => { if (active) setSrc(value); });
    return () => { active = false; };
  }, [id, version]);
  return <Avatar name={formLabel(user)} src={src || undefined} {...props} />;
}
