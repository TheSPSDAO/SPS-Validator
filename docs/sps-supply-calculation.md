# SPS Supply Calculation

## Total Supply

```
total_supply = totalSupplySps + rewardPoolSupply
```

- **totalSupplySps**: `|SUM(balance)| WHERE token IN (SPS, SPSP) AND balance > 0 AND player NOT IN ('null', '$BURNED') AND player NOT LIKE '$%'` — i.e. all real player SPS + staked SPS balances.
- **rewardPoolSupply**: Sum of SPS balances for all reward pool system accounts: `$REWARD_POOLS_BRAWL`, `$REWARD_POOLS_LAND`, `$REWARD_POOLS_LICENSE`, `$VALIDATOR_REWARDS`, `$REWARD_POOLS_SOULKEEP`, `$REWARD_POOLS_MODERN`, `$REWARD_POOLS_WILD`, `$REWARD_POOLS_SURVIVAL`, `$UNCLAIMED_UNISWAP_REWARDS`, `$TOURNAMENTS_DISTRIBUTION`, `$SPS_STAKING_REWARDS`, `$REWARD_POOLS_FOCUS`, `$REWARD_POOLS_SEASON`.

## Circulating Supply

```
circulating_supply = totalSupplySps - daoTotal - bridgeTotal + offChainSupply
```

Where:

- **daoTotal** = three components subtracted:
  - `sps.dao`: SPS + SPSP balance
  - `sps.dao.reserves`: SPS balance
  - `spsdaodelegation`: SPS + SPSP balance

- **bridgeTotal** = sum of (SPS + SPSP) balances across all bridge hive accounts:
  - ETH bridges: `spsoneth`, `deconeth`
  - BSC bridges: `spsonbsc`, `deconbsc`
  - Base bridges: `spsonbase`, `deconbase`
  - Hive bridges: `sl-hive`

- **offChainSupply** = sum of circulating supply on four external chains, each computed as:

  ```
  chain_circulating = chain_total_supply - SUM(excluded_address_balances)
  ```

  - **Hive Engine**: HE total circulating supply of SPS minus balances of `steemmonsters`, `sl-hive`
  - **Ethereum**: ERC-20 total supply minus balances of 5 excluded addresses (bridge/dead contracts)
  - **BSC**: BEP-20 total supply minus balances of 6 excluded addresses
  - **Base**: ERC-20 total supply minus balances of 2 excluded addresses

## In Plain English

**Total supply** counts all SPS + staked SPS held by real players, plus what's sitting in reward pool system accounts. **Circulating supply** takes that player total, subtracts DAO-controlled funds and bridge custodian accounts, then adds back the actual circulating supply observed on each external chain (ETH, BSC, Base, Hive Engine) after excluding known non-circulating addresses on those chains.
