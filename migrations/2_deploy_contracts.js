var MyContract = artifacts.require("./SimpleMultiSig.sol");

module.exports = function(deployer) {
  // deployment steps
  deployer.deploy(MyContract, 2, ["0x5505Ab49B83240A617FdE18d4F1DAAb5AC691E58", "0x7B00aE36C7485B678Fe945c2DD9349Eb5Baf7b6B"], 0);
};