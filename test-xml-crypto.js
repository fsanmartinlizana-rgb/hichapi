const { SignedXml } = require("xml-crypto");
const forge = require("node-forge");

const keys = forge.pki.rsa.generateKeyPair(512);
const cert = forge.pki.createCertificate();
cert.publicKey = keys.publicKey;
cert.sign(keys.privateKey);

const privateKeyPem = forge.pki.privateKeyToPem(keys.privateKey);
const certPem = forge.pki.certificateToPem(cert);

function signXmlElement(xml, referenceUri) {
  const sig = new SignedXml({
    privateKey: privateKeyPem,
    publicCert: certPem,
  });

  sig.addReference({
    xpath:           `/*`,
    digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
    transforms:      ['http://www.w3.org/2000/09/xmldsig#enveloped-signature'],
    uri:             referenceUri
  });

  sig.computeSignature(xml);
  return sig.getSignedXml()
    .replace(/\s+Id="[^"]*"(?=[\s>])/g, '')
}

const doc = `<Documento ID="Test_532"><Foo>Bar</Foo></Documento>`;
const signed = signXmlElement(doc, "#Test_532");
console.log(signed);
