import { Link, Stack, useRouter } from 'expo-router';
import * as React from 'react';

import { Text, View } from '@/components/ui';

export default function NotFoundScreen() {
  const router = useRouter();

  React.useEffect(() => {
    // Site deep links (https://rule34video.com/…) are rewritten by
    // +native-intent, but a non-site URL can still fall through here.
    // Bounce to home instead of leaving a dead-end in the back stack.
    router.replace('/');
  }, [router]);

  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View className="flex-1 items-center justify-center p-4">
        <Text className="mb-4 text-2xl font-bold">This screen doesn't exist.</Text>

        <Link href="/" className="mt-4">
          <Text className="text-blue-500 underline">Go to home screen!</Text>
        </Link>
      </View>
    </>
  );
}
