import { Logger } from '../src/utils/Logger';

describe('Logger', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.restoreAllMocks();
  });

  function setupLogger(env: string): typeof Logger {
    process.env.NODE_ENV = env;
    jest.resetModules();

    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'debug').mockImplementation(() => {});

    return require('../src/utils/Logger').Logger;
  }

  describe('development', () => {
    it('должен вызывать console.info для INFO логов', () => {
      const Logger = setupLogger('development');

      Logger.info('Сообщение для разработчика', { userId: 1 });

      expect(console.info).toHaveBeenCalledTimes(1);
      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('[INFO]: Сообщение для разработчика'),
        { userId: 1 }
      );
    });

    it('должен вызывать console.warn для WARN логов', () => {
      const Logger = setupLogger('development');

      Logger.warn('Внимание!');

      expect(console.warn).toHaveBeenCalledTimes(1);
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('[WARN]: Внимание!')
      );
    });

    it('должен вызывать console.debug для TRACE логов в dev', () => {
      const Logger = setupLogger('development');

      Logger.trace('подробный лог');

      expect(console.debug).toHaveBeenCalledTimes(1);
      expect(console.debug).toHaveBeenCalledWith(
        expect.stringContaining('[TRACE]: подробный лог')
      );
    });
  });

  describe('production', () => {
    it('должен выводить INFO логи в консоль', () => {
      const Logger = setupLogger('production');

      Logger.info('Секретная инфо-логика');

      expect(console.info).toHaveBeenCalledTimes(1);
      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('[INFO]: Секретная инфо-логика')
      );
    });

    it('должен выводить ERROR логи даже на проде', () => {
      const Logger = setupLogger('production');

      Logger.error('Сбой сервера');

      expect(console.error).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR]: Сбой сервера')
      );
    });

    it('НЕ должен выводить DEBUG логи на проде', () => {
      const Logger = setupLogger('production');

      Logger.debug('debug информация');

      expect(console.debug).not.toHaveBeenCalled();
      expect(console.log).not.toHaveBeenCalled();
    });

    it('НЕ должен выводить TRACE логи на проде', () => {
      const Logger = setupLogger('production');

      Logger.trace('trace информация');

      expect(console.debug).not.toHaveBeenCalled();
      expect(console.log).not.toHaveBeenCalled();
    });
  });
});
