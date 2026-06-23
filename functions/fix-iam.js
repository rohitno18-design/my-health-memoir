const { google } = require('googleapis');

async function fixIam() {
  try {
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });
    
    const client = await auth.getClient();
    const projectId = await auth.getProjectId();
    
    console.log(`Using Project: ${projectId}`);
    
    // Get current IAM policy for proxyGemini Cloud Run service
    const serviceName = `projects/${projectId}/locations/us-central1/services/proxygemini`;
    const url = `https://run.googleapis.com/v2/${serviceName}:getIamPolicy`;
    
    console.log(`Fetching IAM policy from ${url}`);
    let res = await client.request({ url });
    let policy = res.data;
    
    console.log("Current policy:", JSON.stringify(policy, null, 2));
    
    // Add allUsers to roles/run.invoker
    let invokerBinding = policy.bindings?.find(b => b.role === 'roles/run.invoker');
    if (!invokerBinding) {
      invokerBinding = { role: 'roles/run.invoker', members: [] };
      if (!policy.bindings) policy.bindings = [];
      policy.bindings.push(invokerBinding);
    }
    
    if (!invokerBinding.members.includes('allUsers')) {
      invokerBinding.members.push('allUsers');
      console.log("Adding allUsers to roles/run.invoker");
      
      const setUrl = `https://run.googleapis.com/v2/${serviceName}:setIamPolicy`;
      const setRes = await client.request({
        url: setUrl,
        method: 'POST',
        data: { policy }
      });
      console.log("Updated policy:", JSON.stringify(setRes.data, null, 2));
    } else {
      console.log("allUsers already has roles/run.invoker");
    }
    
  } catch (err) {
    console.error("Error:", err.response?.data || err.message);
  }
}

fixIam();
