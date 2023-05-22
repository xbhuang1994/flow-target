const { ethers } = require('ethers');
const logger = require('./logger.js');
class Executor {
    constructor(params) {
        this.wsNodeUrl = params.wsNodeUrl;
        this.providers = {};
        this.abiMap = {};
        this.v2Interface = new ethers.utils.Interface(this.abi('v2_router'));
        this.v3Interface = new ethers.utils.Interface(this.abi('v3_router'));
        this.v3r2Interface = new ethers.utils.Interface(this.abi('v3_router2'));
        this.uniInterface = new ethers.utils.Interface(this.abi('uni_router'));
        this.v2Address = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D".toLowerCase();
        this.v3Address = "0xe592427a0aece92de3edee1f18e0157c05861564".toLowerCase();
        this.v3r2Address = "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45".toLowerCase();
        this.uniAddress = "0xef1c6e67703c7bd7107eed8303fbe6ec2554bf6b".toLowerCase();
    }
    abi(name) {
        let abi = this.abiMap[name];
        if (!abi) {
            abi = require(`./abi/${name}_abi.json`);
        }
        this.abiMap[name] = abi;
        return abi;
    }

    wsProvider() {
        return this.provider('ws');
    }
    provider(name) {
        var provider = this.providers[name];
        if (provider) {
            return provider;
        }
        provider = new ethers.providers.WebSocketProvider(this.wsNodeUrl);
        this.providers[name] = provider;
        return provider;
    }
    subscribePendingTx(callback, delayLimit) {
        if (this.subscribed) {
            logger.debug('subscribePendingTx: already subscribed');
            return;
        }

        this.subscribed = true;
        logger.debug('subscribePendingTx: proceeding');

        this.wsSubscribeProvider = new ethers.providers.WebSocketProvider(this.wsNodeUrl);
        this.wsSubscribeProvider.on('pending', async (hash) => {
            this.count++;
            var txReceived = now();

            var tx = await this.getTransaction(hash);
            if (now() - txReceived > (delayLimit || 5000)) {
                this.stallCount++;
                return;
            }

            if (!(tx && tx.to && tx.data != '0x')) {
                this.dropCount++;
                return;
            }
            let txPulled = now();
            let invocation = await this.parseTransaction(tx);
            callback({ tx, invocation, time: { txReceived, txPulled } });
        });
    }
    unsubscribePendingTx() {
        try {
            logger.debug('unsubscribePendingTx');
            this.subscribed = false;
            this.wsSubscribeProvider._websocket.terminate();
        } catch (e) { }
    }

    getTransaction(hash) {
        return this.wsProvider().getTransaction(hash);
    }
    parseTransaction(tx) {
        let to = tx.to.toLowerCase();
        try {
            if (to == this.v2Address) {
                return this.v2Interface.parseTransaction(tx);
            } else if (to == this.v3Address) {
                return this.v3Interface.parseTransaction(tx);
            } else if (to == this.uniAddress) {
                return this.uniInterface.parseTransaction(tx);
            } else if( to == this.v3r2Address){
                return this.v3r2Interface.parseTransaction(tx);
            }
        } catch (e) {
            logger.error('parse failed for: ' + tx, e);
        }
    }
    getBalance(address){
        return this.wsProvider().getBalance(address);
    }

}
function now() {
    return new Date().getTime();
}

module.exports = { Executor };