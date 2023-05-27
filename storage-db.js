const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/dexswap');
const PathSchema = new mongoose.Schema({
    pathStr: String,
    path: [String],
    amountIn: String,
    amountOut: String,
});

const SwapSchema = new mongoose.Schema({
    hash: String,
    routerType: String,
    gasPrice: Number,
    from: String,
    gasLimit: Number,
    firstTime: Number,
    confirmedTime: Number,
    paths: [PathSchema], // 嵌套的Path模式
});

const SwapModel = mongoose.model('Swap', SwapSchema);

module.exports = {
    SwapModel
}


// async function main(){
//     let res = await SwapModel.findOne({'paths.path':'path1'});
//     console.log(res);
//     // saveTest();
// }

// main();

// function saveTest() {
//     let pathsArray = [];

//     // 这里创建你的Path对象
//     let path = {
//         pathStr: "yourPathString",
//         path: ["path1", "path2"],
//         amountIn: 123,
//         amountOut: 456
//     };

//     pathsArray.push(path);

//     let swapModel = new SwapModel({
//         hash: "0x100000",
//         routerType: "10000",
//         paths: pathsArray,
//         gasPrice: 1000,
//         from: "0x1000",
//         gasLimit: 1000,
//         firstTime: new Date().getTime(),
//         confirmedTime: new Date().getTime(),
//     });
//     swapModel.save().then(() => console.log('meow'));
// }
