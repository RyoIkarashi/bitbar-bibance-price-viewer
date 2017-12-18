#!/usr/bin/env /usr/local/bin/node

// <bitbar.title>Binance Price Viewer</bitbar.title>
// <bitbar.version>v1.0</bitbar.version>
// <bitbar.author>Ryo Ikarashi</bitbar.author>
// <bitbar.author.github>RyoIkarashi</bitbar.author.github>
// <bitbar.desc>Display the spot JPY prices of cryptocurrencies and your current balance in binance.com</bitbar.desc>
// <bitbar.image>https://user-images.githubusercontent.com/5750408/32333718-ec1d99e6-c02b-11e7-8990-c26f6629a1df.png</bitbar.image>
// <bitbar.dependencies>node</bitbar.dependencies>
// <bitbar.abouturl>https://github.com/RyoIkarashi/binance-price-viewer</bitbar.abouturl>

// If you feel this little tool gives you some value, tips are always welcome at the following addresses!
// Bitcoin: 1DrLPjzmNHtkdBstd82xvCxGY38PnKauRH
// Mona:    MC7XMmi1YXoJH19D1q4H8ijBkdvarWBTMi

const bitbar = require('bitbar');
const Binance = require('binance-node-api');
const ENV = require('./env.json');
const axios = require('axios');

// create a binance object and set keys
const binance = Object.create(Binance);
binance.init({
  apiKey: ENV.access_key,
  secretKey: ENV.secret_key
});

const BASE_RATE = 'USD';
const BTC_SYMBOL = 'BTCUSDT';
const RATE_API_URL = `https://api.fixer.io/latest?base=${BASE_RATE}`;
const getAccountInfo = () => binance.getAccountInfo({timestamp: Date.now()});
const getTicker = () => binance.getTicker();
const getCoinsWithBTC = (ticker) => ticker.filter(coin => coin.symbol.match(/BTC$/) || coin.symbol === BTC_SYMBOL);
const getLatestYenPerUSD = () => axios.get(RATE_API_URL);
const getTickerWithJPY = (ticker, btcusd, yen) => ticker.map(coin => {
  let newCoin = Object.assign({}, coin);
  newCoin.price = coin.symbol !== BTC_SYMBOL ? newCoin.price * btcusd * yen : newCoin.price * yen;
  return newCoin;
});
const mergeCoinInfo = (ticker, volatilities) => 
  ticker.map((coin, index) => {
    let newCoin;
    volatilities.map(vola => {
      if(coin.symbol === vola.symbol) {
        newCoin = Object.assign({}, coin);
        newCoin.priceChangePercent = Number(vola.priceChangePercent);
        newCoin.symbol = coin.symbol.replace(/BTC$/, '').replace(/USDT$/, '');
      }
    });
    return newCoin;
  });

const getBTCUSD = (ticker) => ticker.filter(coin => coin.symbol === BTC_SYMBOL)[0];
const getBTCJPY = (yen, BTCUSD) => BTCUSD * yen;
const getVolatilities = () => binance.get24hrTicker(); 
const getSortedCoins = (coins, key = 'symbol', order = 'asc') => {
 const compareByProp = (a, b) => {
   if(!a.hasOwnProperty(key) || !b.hasOwnProperty(key)) return 0;

   const A = (typeof a[key] === 'string') ? a[key].toUpperCase() : a[key];
   const B = (typeof b[key] === 'string') ? b[key].toUpperCase() : b[key];
  
   let comparison = 0;
   if(A > B) {
     comparison = 1;
   } else if (A < B) {
     comparison = -1;
   }

   return (order === 'desc') ? comparison * -1 : comparison; 
 };
 return coins.sort(compareByProp);
};

const getTop5Coins = (coins) => getSortedCoins(coins, 'priceChangePercent', 'desc').slice(0, 5);
const getWorst5Coins = (coins) => getSortedCoins(coins, 'priceChangePercent').slice(0, 5);

const getBitbarContent = (coins) =>
  coins.map((coin, index) => {
    const { symbol, price, priceChangePercent } = coin;
    return {
      text: `[${symbol}] ${price} (${priceChangePercent >= 0 ? '↑' : '↓'} ${priceChangePercent}%)`,
      color: `${priceChangePercent >= 0  ? ENV.colors.green: ENV.colors.red}`,
      href: `https://www.binance.com/trade.html?symbol=${symbol}_BTC`,
    }
  });

process.on('unhandledRejection', console.dir);

axios.all([getAccountInfo(), getTicker(), getVolatilities(), getLatestYenPerUSD()])
  .then(axios.spread((rates, ticker, volatilities, rate) => {
    ticker = ticker.data;
    const yen = rate.data.rates.JPY;
    const btcusd = Number(getBTCUSD(ticker).price);
    const coinsWithBTC = getCoinsWithBTC(ticker);
    const BTCJPY = getBTCJPY(yen, btcusd);
    const tickerWithJPY = getTickerWithJPY(coinsWithBTC, btcusd, yen);
    const coins = getSortedCoins(mergeCoinInfo(tickerWithJPY, volatilities.data));
    const contents = getBitbarContent(coins);
    const top5Contents = getBitbarContent(getTop5Coins(coins));
    const worst5Contents = getBitbarContent(getWorst5Coins(coins));
    bitbar([
      'Bibance Prices',
      bitbar.sep,
      'TOP 5',
      ...top5Contents,
      bitbar.sep,
      'BOTTOM 5',
      ...worst5Contents,
      bitbar.sep,
      'ALL COINS',
      ...contents,
    ]);
 }));
