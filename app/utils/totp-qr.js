import Ember from 'ember';

export function totpProvisioningQr(provisioningUri, accessibleLabel) {
  if ( !provisioningUri || typeof window === 'undefined' || typeof window.qrcode !== 'function' ) {
    return null;
  }

  let qr = window.qrcode(0, 'M');
  qr.addData(provisioningUri, 'Byte');
  qr.make();

  return Ember.String.htmlSafe(qr.createSvgTag({
    cellSize: 5,
    margin: 10,
    scalable: true,
    title: accessibleLabel,
    alt: accessibleLabel,
  }));
}
