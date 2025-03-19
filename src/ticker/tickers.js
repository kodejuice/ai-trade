export const SYMBOLS = {
  forex: [
    // majors
    "EURUSD", // on yfiance as "EURUSD=X"
    "GBPUSD",
    "USDJPY",
    "USDCHF",
    "AUDUSD",
    "NZDUSD",
    "USDCAD",

    // extended
    "EURGBP", // on yfiance as "EURGBP=X"
    "EURJPY",
    "EURCHF",
    "EURAUD",
    "EURNZD",
    "EURCAD",
    "GBPJPY",
    "GBPCHF",
    "GBPAUD",
    "GBPNZD",
    "GBPCAD",
    "CHFJPY",
    "AUDJPY",
    "AUDCHF",
    "AUDNZD",
    "AUDCAD",
    "NZDJPY",
    "CADCHF",
    "CADJPY",
    "NZDCAD",
    "NZDCHF",
    "USDMXN",
    "EURMXN",
    "GBPMXN",
    "USDZAR",
    "EURZAR",
    "GBPZAR",
    "ZARJPY",

    // exotic
    "EURHUF", // on yfiance as "EURHUF=X"
    "EURNOK",
    "EURPLN",
    "EURSEK",
    "EURTRY",
    "USDDKK",
    "USDCZK",
    "USDHUF",
    "USDNOK",
    "USDPLN",
    "USDSEK",
    "EURHKD",
    "USDSGD",
    "SGDJPY",
    "USDHKD",
    "USDCNH",
    "USDTRY",
  ],

  ETF: [
    "BRRR.ETF", // on yfinance as "BRRR"
    "IBIT.ETF",
    "FBTC.ETF",
    "ARKB.ETF",
    "BITB.ETF",
    "BTCO.ETF",
    "GBTC.ETF",
  ],

  crypto: [
    "BTCUSD", // on yfinance as "BTC-USD"
    "ETHUSD",
    "LTCUSD",
    "XRPUSD",
    "BCHUSD",
    "SOLUSD",
    "AAVEUSD",
    "ADAUSD",
    "ALGOUSD",
    "ATOMUSD",
    "AVAXUSD",
    "AXSUSD",
    "BNBUSD",
    "DASHUSD",
    "DOGEUSD",
    "DOTUSD",
    "FILUSD",
    "GRTUSD",
    "ICPUSD",
    "IOTAUSD",
    "LINKUSD",
    "LRCUSD",
    "MANAUSD",
    "NEARUSD",
  ],

  stocks: {
    japan: [
      "DAII.TSE", // on yfinance as "4658.T"
      "DKI.TSE", // on yfinance as "6367.T"
      "HIT.TSE", // on yfinance as "6501.T"
      "MUR.TSE", // on yfinance as "6981.T"
      "NID.TSE", // on yfinance as "6954.T"
      "SVN.TSE", // on yfinance as "3382.T"
      "TKY.TSE", // on yfinance as "8035.T"
      "TM.TSE", // on yfinance as "7203.T"
      "TMH.TSE", // on yfinance as "8766.T"
      "OL.TSE", // on yfinance as "4661.T"
      "KEE.TSE", // on yfinance as "6861.T"
    ],

    us: [
      "AAPL.NAS", // on yfinance as "AAPL"
      "ABBV.NYSE",
      "ABNB.NAS",
      "ABT.NYSE",
      "ACN.NYSE",
      "ADBE.NAS",
      "AMD.NAS",
      "AMZN.NAS",
      "AVGO.NAS",
      "AXP.NYSE",
      "BA.NYSE",
      "BABA.NYSE",
      "BAC.NYSE",
      "BKNG.NAS",
      "BLK.NYSE",
      "BMY.NYSE",
      "BX.NYSE",
      "CAT.NYSE",
      "CMCSA.NAS",
      "COP.NYSE",
      "COST.NAS",
      "CRM.NYSE",
      "CSCO.NAS",
      "CVS.NYSE",
      "CVX.NYSE",
      "DHR.NYSE",
      "DIS.NYSE",
      "GE.NYSE",
      "GOOGL.NAS",
      "GS.NYSE",
      "HD.NYSE",
      "HMC.NYSE",
      "HON.NAS",
      "IBM.NYSE",
      "INTC.NAS",
      "INTU.NAS",
      "ISRG.NAS",
      "JNJ.NYSE",
      "JPM.NYSE",
      "KO.NYSE",
      "LIN.NYSE",
      "LLY.NYSE",
      "LMT.NYSE",
      "MA.NYSE",
      "MCD.NYSE",
      "MDLZ.NAS",
      "META.NAS",
      "MMM.NYSE",
      "MRK.NYSE",
      "MS.NYSE",
      "MSFT.NAS",
      "NEE.NYSE",
      "NFLX.NAS",
      "NKE.NYSE",
      "NOW.NYSE",
      "NVDA.NAS",
      "ORCL.NYSE",
      "PEP.NAS",
      "PFE.NYSE",
      "PG.NYSE",
      "PM.NYSE",
      "PYPL.NAS",
      "QCOM.NAS",
      "RTX.NYSE",
      "SAP.NYSE",
      "SBUX.NAS",
      "SHOP.NYSE",
      "SONY.NYSE",
      "T.NYSE",
      "TMO.NYSE",
      "TMUS.NAS",
      "TSLA.NAS",
      "TXN.NAS",
      "UNH.NYSE",
      "UNP.NYSE",
      "UPS.NYSE",
      "V.NYSE",
      "VZ.NYSE",
      "WFC.NYSE",
      "WMT.NYSE",
      "XOM.NYSE",
    ],
  },
};

export const yfinanceMapping = {
  mapSymbol: (symbol) => {
    // Check which category the symbol belongs to
    if (SYMBOLS.ETF.includes(symbol)) {
      return symbol.replace(".ETF", "");
    }

    if (SYMBOLS.stocks.japan.includes(symbol)) {
      const japanMap = {
        "DAII.TSE": "4658.T",
        "DKI.TSE": "6367.T",
        "HIT.TSE": "6501.T",
        "MUR.TSE": "6981.T",
        "NID.TSE": "6954.T",
        "KEE.TSE": "6861.T",
        "OL.TSE": "4661.T",
        "SVN.TSE": "3382.T",
        "TKY.TSE": "8035.T",
        "TM.TSE": "7203.T",
        "TMH.TSE": "8766.T",
      };
      return japanMap[symbol];
    }

    if (SYMBOLS.stocks.us.includes(symbol)) {
      return symbol.replace(/\.(NYSE|NAS)$/, "");
    }

    if (SYMBOLS.crypto.includes(symbol)) {
      return symbol.replace("USD", "-USD");
    }

    if (SYMBOLS.forex.includes(symbol)) {
      return symbol + "=X";
    }

    return symbol; // default case
  },
};

export const getAllTickers = () => {
  const tickers = [
    ...SYMBOLS.forex,
    ...SYMBOLS.crypto,
    ...SYMBOLS.ETF,
    ...SYMBOLS.stocks.us,
    ...SYMBOLS.stocks.japan,
  ];
  return tickers;
  // return tickers.sort(() => Math.random() - 0.5);
};
