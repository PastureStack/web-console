export default function isDisplayedAccount(account) {
  let kind = (account.get('kind') || '').toLowerCase();
  return kind === 'user' || kind === 'admin';
}
