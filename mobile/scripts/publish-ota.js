#!/usr/bin/env node

/**
 * In-App Over-The-Air (OTA) Hot Update Publisher
 *
 * Compiles JavaScript bundle using Metro + Hermes bytecode, generates version manifest,
 * and publishes it to AWS EC2 instance over SSH/SCP.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SSH_KEY = '/home/rasheed/Downloads/expense-key.pem';
const EC2_HOST = '51.21.200.201';
const REMOTE_DIR = '/var/www/expense_web/ota';

// Parse CLI args: node publish-ota.js [version] [--notes "Changelog"]
const args = process.argv.slice(2);
let version = '1.0.1';
let notes = 'Performance improvements and bug fixes';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--notes' && args[i + 1]) {
    notes = args[i + 1];
    i++;
  } else if (!args[i].startsWith('--')) {
    version = args[i];
  }
}

const mobileRoot = path.resolve(__dirname, '..');
const buildDir = path.join(mobileRoot, '.ota_build');
const rawBundlePath = path.join(buildDir, 'index.android.bundle.raw');
const hermesBundlePath = path.join(buildDir, 'index.android.bundle');
const manifestPath = path.join(buildDir, 'version.json');
const hermescBin = path.join(
  mobileRoot,
  'node_modules/react-native/sdks/hermesc/linux64-bin/hermesc'
);

console.log('====================================================');
console.log(`🚀 Publishing OTA Hot Update: v${version}`);
console.log(`📝 Release Notes: "${notes}"`);
console.log('====================================================\n');

try {
  // 1. Prepare clean build directory
  if (fs.existsSync(buildDir)) {
    fs.rmSync(buildDir, { recursive: true, force: true });
  }
  fs.mkdirSync(buildDir, { recursive: true });

  // 2. Run Metro bundle
  console.log('📦 Bundling React Native JavaScript code...');
  const metroCmd = `npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output "${rawBundlePath}"`;
  execSync(metroCmd, { cwd: mobileRoot, stdio: 'inherit' });

  // 3. Compile bytecode with Hermes
  console.log('\n⚙️ Compiling bundle to Hermes bytecode...');
  if (fs.existsSync(hermescBin)) {
    const hermesCmd = `"${hermescBin}" -emit-binary -out "${hermesBundlePath}" "${rawBundlePath}"`;
    execSync(hermesCmd, { cwd: mobileRoot, stdio: 'inherit' });
    fs.unlinkSync(rawBundlePath);
  } else {
    console.log('⚠️ hermesc not found, using raw JavaScript bundle');
    fs.renameSync(rawBundlePath, hermesBundlePath);
  }

  const bundleSizeMb = (fs.statSync(hermesBundlePath).size / (1024 * 1024)).toFixed(2);
  console.log(`✅ Bundle ready (${bundleSizeMb} MB)`);

  // 4. Create version.json manifest
  const manifest = {
    version,
    bundleUrl: `http://${EC2_HOST}/ota/index.android.bundle`,
    releaseNotes: notes,
    publishedAt: new Date().toISOString(),
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  console.log('📋 Manifest version.json created.');

  // 5. Upload to AWS EC2 over SCP
  console.log(`\n☁️ Uploading OTA bundle to AWS EC2 (${EC2_HOST})...`);
  const scpCmd = `scp -i "${SSH_KEY}" -o StrictHostKeyChecking=no "${hermesBundlePath}" "${manifestPath}" ubuntu@${EC2_HOST}:${REMOTE_DIR}/`;
  execSync(scpCmd, { stdio: 'inherit' });

  console.log('\n🎉 OTA Update successfully published!');
  console.log(`👉 Version: v${version}`);
  console.log(`👉 Manifest URL: http://${EC2_HOST}/ota/version.json`);
  console.log(`👉 Bundle URL:   http://${EC2_HOST}/ota/index.android.bundle`);
  console.log('\nAll mobile users will now receive this update in-app!');
} catch (error) {
  console.error('\n❌ OTA Publish failed:', error.message);
  process.exit(1);
}
