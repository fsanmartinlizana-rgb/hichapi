const IS_STAFF = process.env.APP_VARIANT === 'staff';

module.exports = {
  expo: {
    name: IS_STAFF ? "HiChapi Staff" : "HiChapi",
    slug: IS_STAFF ? "hichapi-staff-app" : "hichapi-mobile-app",
    version: "1.0.0",
    orientation: "portrait",
    icon: IS_STAFF ? "./assets/icon-staff.png" : "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: false,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: IS_STAFF ? "#1A1A2E" : "#FF6B35"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: IS_STAFF ? "com.hichapi.staffapp" : "com.hichapi.mobileapp",
      infoPlist: {
        NSCameraUsageDescription: "Se necesita acceso a la cámara para escanear códigos QR.",
        NSPhotoLibraryUsageDescription: "Se necesita acceso a la galería."
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: IS_STAFF ? "./assets/adaptive-icon-staff.png" : "./assets/adaptive-icon.png",
        backgroundColor: IS_STAFF ? "#1A1A2E" : "#FF6B35"
      },
      package: IS_STAFF ? "com.hichapi.staffapp" : "com.hichapi.mobileapp",
      permissions: [
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE",
        "RECEIVE_BOOT_COMPLETED",
        "VIBRATE"
      ]
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    plugins: [
      [
        "expo-camera",
        {
          cameraPermission: "Se necesita acceso a la cámara para escanear códigos QR."
        }
      ],
      [
        "expo-notifications",
        {
          icon: "./assets/notification-icon.png",
          color: "#ffffff",
          sounds: []
        }
      ]
    ],
    scheme: IS_STAFF ? "hichapi-staff" : "hichapi",
    extra: {
      eas: {
        projectId: "YOUR_EAS_PROJECT_ID"
      },
      variant: IS_STAFF ? "staff" : "comensal"
    }
  }
};
