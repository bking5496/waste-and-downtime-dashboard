/**
 * Environment configuration and validation
 * Provides type-safe access to environment variables with validation
 */

// Environment types
type Environment = 'development' | 'production' | 'test';

// Configuration interface
interface AppConfig {
  env: Environment;
  isProduction: boolean;
  isDevelopment: boolean;
  isTest: boolean;
  supabase: {
    url: string | null;
    anonKey: string | null;
    isConfigured: boolean;
  };
  app: {
    name: string;
    version: string;
    homepage: string;
  };
  features: {
    enableChat: boolean;
    enableQRScanner: boolean;
    enableOfflineMode: boolean;
    enableErrorReporting: boolean;
  };
}

// Validate required environment variables
const validateEnvVars = (): string[] => {
  const warnings: string[] = [];

  // Supabase is optional but warn if partially configured
  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
  const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

  if ((supabaseUrl && !supabaseKey) || (!supabaseUrl && supabaseKey)) {
    warnings.push(
      'Supabase is partially configured. Set both REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY for full functionality.'
    );
  }

  return warnings;
};

// Get environment
const getEnvironment = (): Environment => {
  const env = process.env.NODE_ENV;
  if (env === 'production') return 'production';
  if (env === 'test') return 'test';
  return 'development';
};

// Build configuration object
const buildConfig = (): AppConfig => {
  const env = getEnvironment();
  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || null;
  const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || null;

  return {
    env,
    isProduction: env === 'production',
    isDevelopment: env === 'development',
    isTest: env === 'test',
    supabase: {
      url: supabaseUrl,
      anonKey: supabaseKey,
      isConfigured: Boolean(supabaseUrl && supabaseKey),
    },
    app: {
      name: 'Production Control',
      version: process.env.REACT_APP_VERSION || '1.0.0',
      homepage: 'https://bking5496.github.io/waste-and-downtime-dashboard',
    },
    features: {
      enableChat: true,
      enableQRScanner: true,
      enableOfflineMode: true,
      enableErrorReporting: env === 'production',
    },
  };
};

// Log configuration warnings on startup
const logConfigWarnings = (warnings: string[]): void => {
  if (warnings.length > 0 && process.env.NODE_ENV !== 'test') {
    console.group('Configuration Warnings');
    warnings.forEach((w) => console.warn(w));
    console.groupEnd();
  }
};

// Initialize and export configuration
const warnings = validateEnvVars();
logConfigWarnings(warnings);

export const config = buildConfig();

// Helper function to check if a feature is enabled
export const isFeatureEnabled = (feature: keyof AppConfig['features']): boolean => {
  return config.features[feature];
};

// Helper function to get Supabase config
export const getSupabaseConfig = (): { url: string; anonKey: string } | null => {
  if (!config.supabase.isConfigured) {
    return null;
  }
  return {
    url: config.supabase.url!,
    anonKey: config.supabase.anonKey!,
  };
};

// Check if running in offline mode (no Supabase)
export const isOfflineMode = (): boolean => {
  return !config.supabase.isConfigured;
};

// Export config warnings for debugging
export const getConfigWarnings = (): string[] => warnings;

// Type-safe environment variable access
export const getEnvVar = (key: string, defaultValue = ''): string => {
  return process.env[`REACT_APP_${key}`] || defaultValue;
};

export default config;
