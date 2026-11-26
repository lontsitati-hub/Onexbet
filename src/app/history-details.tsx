import React, { useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useBetStore } from '@/store/useBetStore';

export default function HistoryDetailsRedirect() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const setSelectedHistoryId = useBetStore((state) => state.setSelectedHistoryId);

  useEffect(() => {
    if (id) {
      setSelectedHistoryId(id);
    }
    router.replace('/');
  }, [id]);

  return null;
}
