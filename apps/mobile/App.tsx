import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';

// Keep splash screen visible while we initialize
SplashScreen.preventAutoHideAsync().catch(() => {});
SystemUI.setBackgroundColorAsync('#171717');

const WEB_APP_URL = 'https://catbuddy.ganzhibin.icu/app';

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Handle Android back button
  useEffect(() => {
    const onBackPress = () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true;
      }
      return false;
    };

    BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
  }, [canGoBack]);

  const onNavigationStateChange = useCallback((navState: WebViewNavigation) => {
    setCanGoBack(navState.canGoBack);
  }, []);

  const onLoadEnd = useCallback(() => {
    setIsLoading(false);
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  const onError = useCallback(() => {
    setIsLoading(false);
    setError('无法连接到服务器，请检查网络后重试');
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  const retry = useCallback(() => {
    setError(null);
    setIsLoading(true);
    webViewRef.current?.reload();
  }, []);

  // Error screen
  if (error) {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>😿</Text>
          <Text style={styles.errorTitle}>连接失败</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={retry} activeOpacity={0.7}>
            <Text style={styles.retryText}>重新连接</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Loading overlay */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={styles.loadingText}>加载中...</Text>
          </View>
        )}

        <WebView
          ref={webViewRef}
          source={{ uri: WEB_APP_URL }}
          style={[styles.webView, isLoading && styles.webViewHidden]}
          onNavigationStateChange={onNavigationStateChange}
          onLoadEnd={onLoadEnd}
          onError={onError}
          allowsBackForwardNavigationGestures
          sharedCookiesEnabled
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState={false}
          // iOS-specific
          allowsInlineMediaPlayback
          // Android-specific
          setSupportMultipleWindows={false}
          overScrollMode="never"
          // Custom user agent to identify mobile app
          applicationNameForUserAgent="CatBuddyApp"
          // Handle external links
          onShouldStartLoadWithRequest={(request) => {
            const url = request.url.toLowerCase();
            // Keep navigation within the app domain
            if (url.startsWith('https://catbuddy.ganzhibin.icu')) {
              return true;
            }
            // Block external navigation (could open system browser instead)
            return false;
          }}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#171717',
  },
  webView: {
    flex: 1,
  },
  webViewHidden: {
    opacity: 0,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#171717',
    zIndex: 10,
  },
  loadingText: {
    color: '#a1a1aa',
    fontSize: 14,
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#171717',
    padding: 32,
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorTitle: {
    color: '#fafafa',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  errorMessage: {
    color: '#a1a1aa',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
