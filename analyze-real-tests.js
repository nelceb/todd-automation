const jwt = require('jsonwebtoken');

async function generateGitHubAppToken() {
  try {
    const appId = '2116348';
    const privateKey = `-----BEGIN RSA PRIVATE KEY-----
MIIEpQIBAAKCAQEAyg9GQjJeO3jAte/0kU1qdrslxUSyMX9aTD1T/9t7v66r1PCr
SAoPLPkPHiJPZv97W1yD3w3oNcIEKeFWYkV/muLg+O2oVSyMeMpV98Ml4UCNd4N5
dYb2ukt4ES9UUKj2cclv3xu58r4/wrYoSzd3byQSM2qd6FGwbWAFo1DYgR5lvqJX
3+U0AeKn4VQdwV9/DTK4hAKLdxTY5gsosFU3CTkCdfS8dQqMaLoHetKtvhcIwVxL
NT9+krqoyr27hYKc0DDqDCR96i5DW7lV9vFgpUbtWdsPRzGGg8py9x6t4tKFRr3M
8hcS+DPY34TQoCQQc/68C1e6QxUnakQBNERPfwIDAQABAoIBABX99Zqs2r7EVM04
kbji4SyND/5ZjL+AafaUUjktzVk+jKs/ipTrq10sum2ANH40XlvCRQQZAmYfeM6K
HRnTEKFuAih1zXV/xMY814CA9/V9Tihs4eJdzyrVnfrY2OdyjGg0EX4KCYIXHN93
bglJvzEUjvqTpx4rDfXJlrOA0B+1WrBjlIZigp6ggxh5jWNSQE6qxP7362tc/Sez
EFKwM+hU9qDDl1KygtcNnngKZS9WSez+nlDhKoQ5xWQzt4QjC98B/x8mIy9nZQyT
gdOII1/hYvDEcArrdKqqt5lGpVfFqYAAMbywei5wBKTkcKYbCiL+Zn0B6iiNMY50
qu3BXpkCgYEA74IRySjzuOTkeXt8+RT8E/vipr/SydFId+nY2+144Ounoe5mXW6A
YjYYVthsjc+Fcw3Xb7clETkGjRveKd3Kh1i/9ng4AqhcJASlecI9GBcDQn3Nsplz
kqL3099Nszy9eVSw+qY4lQT0rMBZ/A7OqO6/J2/MujWn74sr6C/xDy0CgYEA1/kV
LCCZzXmMGTAEzLZzS3Ou5tDk/BDOZ+xKITM/cR8CElYFTlOZuLsRLhSasd5LMite
1thP7JnBi2h9dQVDTI4XnifQsOR8uZgpRZN9YDTM4SeoaV7pJIEOQqRQpt4bB8tf
ROVTNZmWardfLHo7YDKltG1Ng/cyyUXEGjjSJNsCgYEAwrMd+kVMO5X3FbqJUYL5
mNU+3wc5N87l9nUnUUGu7kkjsMO4e2OFAlGvX4n4VR/KAEnURIDBpUqSRMvOwoIG
ThiblKUOAzsSDEWqr1xzhc3PXJIgUXvlM+M/TAFPjNFnxeZPKLNPc/TfYj/L5tey
sCnFQy3jY8yShGzCeLHgaNECgYEApPaCb4QvNj0i/5In+F1bz0P7Uh446TfFEKfx
L06/pJ30rSC7SMqeXfW096eRSU7rzNRHyn7K/YOry9nyCdINR4o5C/qJcrPzeKd6
zsQLPdLWsxvhjSqLlfBlfg2X9P0tVFTI3gzz87ruo3CQ554tgBrvatMaJDRKvGXn
lcfU64UCgYEAnQZ0x9PTXPKwDT5MbtA8+jGGOEbBCsyXP+RB1G8EM+LhhgBc4lPP
tGtTw+ugNeZlMi+AyqoZk4K0k3HOJhQhJ1ukeLTQTJJAAh0OburvD/MXt7UvLjOR
xRZS798wJn1TvSJpQr77ms9/gk2UPEoQt5aMTw+kzArRwki+ntdSKkc=
-----END RSA PRIVATE KEY-----`;

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iat: now - 60,
      exp: now + 600,
      iss: appId
    };

    const token = jwt.sign(payload, privateKey, { algorithm: 'RS256' });

    // Obtener instalaciones
    const installationsResponse = await fetch('https://api.github.com/app/installations', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'GitHub-App'
      }
    });

    if (!installationsResponse.ok) {
      console.error('Failed to get installations:', installationsResponse.statusText);
      return null;
    }

    const installations = await installationsResponse.json();
    console.log('Found installations:', installations.length);
    
    if (!installations || installations.length === 0) {
      console.error('No installations found');
      return null;
    }

    const installationId = installations[0].id;
    console.log('Using installation ID:', installationId);

    // Intercambiar JWT por access token
    const response = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'GitHub-App'
      }
    });

    if (!response.ok) {
      console.error('Failed to get access token:', response.statusText);
      return null;
    }

    const data = await response.json();
    return data.token;
  } catch (error) {
    console.error('Error generating token:', error);
    return null;
  }
}

async function analyzeTests() {
  console.log('🔍 Analyzing pw-cookunity-automation tests...');
  
  const token = await generateGitHubAppToken();
  if (!token) {
    console.error('❌ Could not get GitHub token');
    return;
  }

  console.log('✅ Got GitHub token, analyzing tests...');

  try {
    // 1. List coreUx directory
    console.log('\n📁 CoreUx directory contents:');
    const coreUxResponse = await fetch('https://api.github.com/repos/Cook-Unity/pw-cookunity-automation/contents/tests/frontend/desktop/subscription/coreUx', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (coreUxResponse.ok) {
      const coreUxFiles = await coreUxResponse.json();
      console.log('Files in coreUx:');
      coreUxFiles.forEach(file => {
        console.log(`  - ${file.name} (${file.type})`);
      });

      // 2. Analyze ordersHub.spec.ts
      console.log('\n📄 Analyzing ordersHub.spec.ts:');
      const ordersHubResponse = await fetch('https://api.github.com/repos/Cook-Unity/pw-cookunity-automation/contents/tests/frontend/desktop/subscription/coreUx/ordersHub.spec.ts', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (ordersHubResponse.ok) {
        const ordersHubData = await ordersHubResponse.json();
        const content = Buffer.from(ordersHubData.content, 'base64').toString('utf-8');
        console.log('ordersHub.spec.ts content:');
        console.log('='.repeat(80));
        console.log(content);
        console.log('='.repeat(80));
      } else {
        console.error('❌ Could not access ordersHub.spec.ts:', ordersHubResponse.status);
      }

      // 3. Analyze homePage.spec.ts
      console.log('\n📄 Analyzing homePage.spec.ts:');
      const homePageResponse = await fetch('https://api.github.com/repos/Cook-Unity/pw-cookunity-automation/contents/tests/frontend/desktop/subscription/coreUx/homePage.spec.ts', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (homePageResponse.ok) {
        const homePageData = await homePageResponse.json();
        const content = Buffer.from(homePageData.content, 'base64').toString('utf-8');
        console.log('homePage.spec.ts content:');
        console.log('='.repeat(80));
        console.log(content);
        console.log('='.repeat(80));
      } else {
        console.error('❌ Could not access homePage.spec.ts:', homePageResponse.status);
      }

    } else {
      console.error('❌ Could not access coreUx directory:', coreUxResponse.status);
      const errorText = await coreUxResponse.text();
      console.error('Error details:', errorText);
    }

  } catch (error) {
    console.error('❌ Error analyzing tests:', error);
  }
}

analyzeTests();
