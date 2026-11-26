import { useBetStore } from '@/store/useBetStore';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

export default function BetDetailsRedirect() {
  const router = useRouter();
  const setActiveTab = useBetStore((state) => state.setActiveTab);

  useEffect(() => {
    setActiveTab('coupon');
    router.replace('/');
  }, []);

  return null;
}
