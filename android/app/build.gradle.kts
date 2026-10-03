import java.io.File
import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.jetbrains.kotlin.android)
}

// The path may be supplied in the user's ~/.gradle/gradle.properties or with -P.
// Credentials and the upload key stay outside this repository.
val uploadSigningFile = providers.gradleProperty("allNewsSigningProperties")
    .orNull?.takeIf { it.isNotBlank() }?.let { rootProject.file(it) }
val uploadSigningProperties = Properties().apply {
    uploadSigningFile?.takeIf { it.isFile }?.inputStream()?.use { load(it) }
}
val signingPropertyNames = listOf("storeFile", "storePassword", "keyAlias", "keyPassword")
val uploadSigningConfigured = signingPropertyNames.all {
    !uploadSigningProperties.getProperty(it).isNullOrBlank()
}

android {
    namespace = "com.rssallnews.allnews"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.rssallnews.allnews"
        minSdk = 24
        targetSdk = 36
        versionCode = 37
        versionName = "1.1.37"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }
    }

    // Bundle the same HTML/CSS/JS that the web app serves. No second asset copy.
    sourceSets.getByName("main").assets.setSrcDirs(listOf(rootProject.file("../public")))

    signingConfigs {
        if (uploadSigningConfigured) {
            create("upload") {
                val configuredStore = File(uploadSigningProperties.getProperty("storeFile"))
                storeFile = if (configuredStore.isAbsolute) configuredStore else
                    File(uploadSigningFile!!.parentFile, configuredStore.path)
                storePassword = uploadSigningProperties.getProperty("storePassword")
                keyAlias = uploadSigningProperties.getProperty("keyAlias")
                keyPassword = uploadSigningProperties.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            if (uploadSigningConfigured) {
                signingConfig = signingConfigs.getByName("upload")
            }
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }
    kotlinOptions {
        jvmTarget = "1.8"
    }
    buildFeatures {
        compose = true
    }
    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.1"
    }
    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.ui)
    implementation(libs.androidx.ui.graphics)
    implementation(libs.androidx.ui.tooling.preview)
    implementation(libs.androidx.material3)
    implementation(libs.androidx.appcompat)
    implementation(libs.androidx.webkit)
    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.ui.test.junit4)
    debugImplementation(libs.androidx.ui.tooling)
    debugImplementation(libs.androidx.ui.test.manifest)
}

val validateUploadSigning by tasks.registering {
    doLast {
        check(uploadSigningConfigured) {
            "Release signing is not configured. Set allNewsSigningProperties to an external " +
                "properties file containing storeFile, storePassword, keyAlias and keyPassword. " +
                "Debug builds do not require this file."
        }
    }
}
tasks.matching { it.name == "preReleaseBuild" }.configureEach {
    dependsOn(validateUploadSigning)
}
