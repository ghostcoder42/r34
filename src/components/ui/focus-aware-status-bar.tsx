import { useColorScheme } from 'nativewind';
import { Platform } from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';

type Props = { hidden?: boolean };
export const FocusAwareStatusBar = ({ hidden = false }: Props) => {
  const { colorScheme } = useColorScheme();

  if (Platform.OS === 'web') return null;

  return <SystemBars style={colorScheme} hidden={hidden} />;
};
