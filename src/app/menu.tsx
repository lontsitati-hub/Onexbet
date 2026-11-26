import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useBetStore } from '@/store/useBetStore';

export default function MenuRedirect() {
  const router = useRouter();
  const setActiveTab = useBetStore((state) => state.setActiveTab);

  useEffect(() => {
    setActiveTab('menu');
    router.replace('/');
  }, []);

  return null;
}
