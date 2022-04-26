let MetaApi = require('metaapi.cloud-sdk').default;
let CopyFactory = require('metaapi.cloud-sdk').CopyFactory;

// your MetaApi API token
let token = process.env.TOKEN || '<put in your token here>';
// your master MetaApi account id
// master account must have PROVIDER value in copyFactoryRoles
let masterAccountId = process.env.MASTER_ACCOUNT_ID || '<put in your masterAccountId here>';

// The strategy will publish all signals to the telegram channel, including external signals and
// signals generated by MT terminal. For this code example we use external signals, however you can 
// publish MT signals as well.
// Please refer to https://metaapi.cloud/docs/copyfactory/features/telegram/publish/ for details.
// Telegram bot token
let botToken = process.env.TELEGRAM_BOT_TOKEN || '<put in your botToken here>';
// Telegram chat id
let chatId = process.env.TELEGRAM_CHAT_ID || '<put in your chatId here>';

const api = new MetaApi(token);
const copyFactory = new CopyFactory(token);

async function telegram() {
  try {
    let masterMetaapiAccount = await api.metatraderAccountApi.getAccount(masterAccountId);
    if(!masterMetaapiAccount.copyFactoryRoles || !masterMetaapiAccount.copyFactoryRoles.includes('PROVIDER')) {
      throw new Error('Please specify PROVIDER copyFactoryRoles value in your MetaApi account in ' +
        'order to use it in CopyFactory API');
    }

    let configurationApi = copyFactory.configurationApi;
    const strategies = await configurationApi.getStrategies();
    const strategy = strategies.find(s => s.accountId === masterMetaapiAccount.id);
    let strategyId;
    if(strategy) {
      strategyId = strategy._id;
    } else {
      strategyId = await configurationApi.generateStrategyId();
      strategyId = strategyId.id;
    }

    // create a strategy being copied
    await configurationApi.updateStrategy(strategyId, {
      name: 'Test strategy',
      description: 'Some useful description about your strategy',
      accountId: masterMetaapiAccount.id,
      telegram: {
        publishing: {
          token: botToken,
          chatId: chatId,
          template: '${description}'
        }
      }
    });

    // send external signal
    const tradingApi = copyFactory.tradingApi;
    const signalClient = await tradingApi.getSignalClient(masterMetaapiAccount.id);
    const signalId = signalClient.generateSignalId();
    await signalClient.updateExternalSignal(strategyId, signalId, {
      symbol: 'EURUSD',
      type: 'POSITION_TYPE_BUY',
      time: new Date(),
      volume: 0.01
    });

    await new Promise(res => setTimeout(res, 5000));

    // remove external signal
    await signalClient.removeExternalSignal(strategyId, signalId, {
      time: new Date()
    });
  } catch (err) {
    console.error(err);
  }
  process.exit();
}

telegram();
