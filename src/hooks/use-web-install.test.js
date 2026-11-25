/* global __dirname, test, jest, expect */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const html = fs.readFileSync(path.join(__dirname, '../../public/index.html'), 'utf8');

test('설정이 열리기 전에 받은 설치 신호를 보관하고 설치 뒤에는 지운다', () => {
  const web = new EventTarget();
  const changed = jest.fn();
  web.addEventListener('babti-install-change', changed);
  vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], { window: web, Event });

  web.dispatchEvent(new Event('beforeinstallprompt'));
  expect(web.babtiInstallPrompt).toBeUndefined();
  const signal = new Event('beforeinstallprompt', { cancelable: true });
  signal.prompt = jest.fn();
  web.dispatchEvent(signal);
  expect(signal.defaultPrevented).toBe(true);
  expect(web.babtiInstallPrompt).toBe(signal);
  expect(changed).toHaveBeenCalledTimes(1);

  web.dispatchEvent(new Event('appinstalled'));
  expect(web.babtiInstallPrompt).toBeUndefined();
  expect(changed).toHaveBeenCalledTimes(2);
});
