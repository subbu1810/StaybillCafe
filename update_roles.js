const fs = require('fs');
const path = require('path');
const routesDir = path.join(__dirname, 'routes');

fs.readdirSync(routesDir).forEach(file => {
  if (file.endsWith('.js')) {
    const filePath = path.join(routesDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let newContent = content.replace(/roles\('admin'\)/g, "roles('admin', 'superadmin')");
    if (content !== newContent) {
      fs.writeFileSync(filePath, newContent);
      console.log('Updated', file);
    }
  }
});
