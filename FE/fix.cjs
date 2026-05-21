const fs = require('fs');
let data = fs.readFileSync('src/pages/TaskList/index.tsx', 'utf8');

data = data.replace(
  'import { taskService } from "../../services/taskService";', 
  'import { taskService } from "../../services/taskService";\nimport { getProfile } from "../../services/authService";'
);

data = data.replace(
  'useEffect(() => {\r\n    void loadData();\r\n  }, []);', 
  'useEffect(() => {\n    void loadData();\n    getProfile().then(res => setUserId((res.data as any)?.id)).catch(() => {});\n  }, []);'
);

data = data.replace(
  'useEffect(() => {\n    void loadData();\n  }, []);', 
  'useEffect(() => {\n    void loadData();\n    getProfile().then(res => setUserId((res.data as any)?.id)).catch(() => {});\n  }, []);'
);

fs.writeFileSync('src/pages/TaskList/index.tsx', data);
console.log('Injected getProfile!');
