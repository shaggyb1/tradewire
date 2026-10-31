import { Platform, useWindowDimensions } from 'react-native';

export const SIDEBAR_WIDTH = 216;
/** Room for the browser's scrollbar */
const SCROLLBAR = 16;

/** Sizes for the current screen. On a large browser window the app becomes a full-page dashboard. */
export function useLayout() {
  const { width } = useWindowDimensions();
  const wide = Platform.OS === 'web' && width >= 960;
  const contentWidth = wide ? width - SIDEBAR_WIDTH - SCROLLBAR : width;
  const columns = !wide ? 1 : contentWidth >= 1500 ? 3 : 2;
  return { width, wide, contentWidth, columns };
}
