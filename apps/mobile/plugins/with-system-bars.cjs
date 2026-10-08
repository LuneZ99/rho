const { withAndroidStyles } = require("expo/config-plugins");

// Android 11 的三键导航也采用应用的深色外观，并保留系统安全区域。
module.exports = function withSystemBars(config) {
  return withAndroidStyles(config, (mod) => {
    const theme = mod.modResults.resources.style.find(
      (style) => style.$.name === "AppTheme",
    );
    const values = {
      "android:windowLightNavigationBar": "false",
      "android:enforceNavigationBarContrast": "false",
    };
    theme.item = (theme.item ?? []).filter((item) => !(item.$.name in values));
    for (const [name, value] of Object.entries(values))
      theme.item.push({ $: { name }, _: value });
    return mod;
  });
};
