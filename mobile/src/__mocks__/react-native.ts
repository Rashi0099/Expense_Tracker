export const Platform = {
  OS: 'android' as const,
  select: <T>(obj: { ios?: T; android?: T; default?: T }): T =>
    (obj.android !== undefined ? obj.android : obj.default !== undefined ? obj.default : ({} as T)),
};

export const StyleSheet = {
  create: <T extends Record<string, any>>(styles: T): T => styles,
};

export const View = 'View';
export const Text = 'Text';
export const TouchableOpacity = 'TouchableOpacity';
export const TextInput = 'TextInput';
export const ScrollView = 'ScrollView';
export const FlatList = 'FlatList';
export const ActivityIndicator = 'ActivityIndicator';
export const StatusBar = 'StatusBar';
export const KeyboardAvoidingView = 'KeyboardAvoidingView';
export const Alert = {
  alert: () => {},
};
export const useColorScheme = () => 'light';
export const AppRegistry = {
  registerComponent: () => {},
};
