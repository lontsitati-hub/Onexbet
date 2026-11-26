import { copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve("dist/client");
const projectRoot = path.resolve(".");
const iconFontSource = path.join(projectRoot, "node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts");
const iconFonts = [
  ["Ionicons", "ionicons.ttf"],
  ["FontAwesome", "fontawesome.ttf"],
  ["FontAwesome5_Brands", "fontawesome5-brands.ttf"],
  ["FontAwesome5_Regular", "fontawesome5-regular.ttf"],
  ["FontAwesome5_Solid", "fontawesome5-solid.ttf"],
  ["MaterialCommunityIcons", "material-community.ttf"],
];
const tags = {
  manifest: '<link rel="manifest" href="/manifest.webmanifest">',
  appleIcon:
    '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">',
  appleCapable: '<meta name="apple-mobile-web-app-capable" content="yes">',
  appleTitle: '<meta name="apple-mobile-web-app-title" content="1xbet.cm">',
  mobileCapable: '<meta name="mobile-web-app-capable" content="yes">',
  themeColor: '<meta name="theme-color" content="#03346D">',
};
const iconFontStyles = '<style id="onexbet-icon-fonts">'
  + '@font-face{font-family:"ionicons";src:url("/fonts/ionicons.ttf") format("truetype");font-display:block;}'
  + '@font-face{font-family:"FontAwesome";src:url("/fonts/fontawesome.ttf") format("truetype");font-display:block;}'
  + '@font-face{font-family:"FontAwesome5Free-Brand";src:url("/fonts/fontawesome5-brands.ttf") format("truetype");font-display:block;}'
  + '@font-face{font-family:"FontAwesome5Free-Regular";src:url("/fonts/fontawesome5-regular.ttf") format("truetype");font-display:block;}'
  + '@font-face{font-family:"FontAwesome5Free-Light";src:url("/fonts/fontawesome5-regular.ttf") format("truetype");font-display:block;}'
  + '@font-face{font-family:"FontAwesome5Free-Solid";src:url("/fonts/fontawesome5-solid.ttf") format("truetype");font-display:block;}'
  + '@font-face{font-family:"material-community";src:url("/fonts/material-community.ttf") format("truetype");font-display:block;}'
  + '</style>';

async function collectHtml(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectHtml(file)));
    else if (entry.isFile() && entry.name.endsWith(".html")) files.push(file);
  }
  return files;
}

const publicFontDirectory = path.join(root, "fonts");
await mkdir(publicFontDirectory, { recursive: true });
for (const [sourceName, publicName] of iconFonts) {
  await copyFile(path.join(iconFontSource, `${sourceName}.ttf`), path.join(publicFontDirectory, publicName));
}

const fontUrlReplacements = [
  [/url\(["']\/assets\/node_modules\/@expo\/vector-icons\/build\/vendor\/react-native-vector-icons\/Fonts\/Ionicons\.[^"')]+\.ttf["']\)/g, 'url("/fonts/ionicons.ttf")'],
  [/url\(["']\/assets\/node_modules\/@expo\/vector-icons\/build\/vendor\/react-native-vector-icons\/Fonts\/FontAwesome\.[^"')]+\.ttf["']\)/g, 'url("/fonts/fontawesome.ttf")'],
  [/url\(["']\/assets\/node_modules\/@expo\/vector-icons\/build\/vendor\/react-native-vector-icons\/Fonts\/FontAwesome5_Brands\.[^"')]+\.ttf["']\)/g, 'url("/fonts/fontawesome5-brands.ttf")'],
  [/url\(["']\/assets\/node_modules\/@expo\/vector-icons\/build\/vendor\/react-native-vector-icons\/Fonts\/FontAwesome5_Regular\.[^"')]+\.ttf["']\)/g, 'url("/fonts/fontawesome5-regular.ttf")'],
  [/url\(["']\/assets\/node_modules\/@expo\/vector-icons\/build\/vendor\/react-native-vector-icons\/Fonts\/FontAwesome5_Solid\.[^"')]+\.ttf["']\)/g, 'url("/fonts/fontawesome5-solid.ttf")'],
  [/url\(["']\/assets\/node_modules\/@expo\/vector-icons\/build\/vendor\/react-native-vector-icons\/Fonts\/MaterialCommunityIcons\.[^"')]+\.ttf["']\)/g, 'url("/fonts/material-community.ttf")'],
];

const htmlFiles = await collectHtml(root);
if (htmlFiles.length === 0) {
  throw new Error(`No exported HTML pages found in ${root}`);
}

let changed = 0;
for (const file of htmlFiles) {
  const originalHtml = await readFile(file, "utf8");
  let html = originalHtml;
  for (const [pattern, replacement] of fontUrlReplacements) {
    html = html.replace(pattern, replacement);
  }
  const additions = [];
  if (!/href=["']\/manifest\.webmanifest["']/i.test(html)) {
    additions.push(tags.manifest);
  }
  if (!/href=["']\/apple-touch-icon\.png["']/i.test(html)) {
    additions.push(tags.appleIcon);
  }
  if (!/name=["']apple-mobile-web-app-capable["']/i.test(html)) {
    additions.push(tags.appleCapable);
  }
  if (!/name=["']apple-mobile-web-app-title["']/i.test(html)) {
    additions.push(tags.appleTitle);
  }
  if (!/name=["']mobile-web-app-capable["']/i.test(html)) {
    additions.push(tags.mobileCapable);
  }
  if (!/name=["']theme-color["']/i.test(html)) {
    additions.push(tags.themeColor);
  }
  if (!html.includes('id="onexbet-icon-fonts"')) {
    additions.push(iconFontStyles);
  }
  if (additions.length > 0) {
    const headTag = /<head(?:\s[^>]*)?>/i;
    if (!headTag.test(html)) {
      throw new Error(`Exported HTML has no <head>: ${file}`);
    }
    html = html.replace(headTag, (match) => `${match}${additions.join("")}`);
  }
  if (html === originalHtml) continue;
  await writeFile(file, html);
  changed += 1;
}

console.log(`PWA metadata and public icon fonts present in ${htmlFiles.length} exported HTML pages (${changed} updated).`);
