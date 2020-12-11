import { BigInt, ByteArray, crypto, ethereum, log } from "@graphprotocol/graph-ts";
import {
    Dice2Win,
    FailedPayment,
    Payment,
    JackpotPayment,
    Commit,
    RefundBetCall,
    SettleBetCall,
    SettleBetUncleMerkleProofCall,
    PlaceBetCall,
} from "../generated/Dice2Win/Dice2Win";

import { Bet, Jackpot, DayData } from "../generated/schema";

let BIGINT_ZERO = BigInt.fromI32(0);
let BIGINT_ONE = BigInt.fromI32(1);

// Entities can be loaded from the store using a string ID; this ID
// needs to be unique across all entities of the same type
// let entity = ExampleEntity.load(event.transaction.from.toHex())
// Entities only exist after they have been saved to the store;
// `null` checks allow to create entities on demand
// if (entity == null) {
//   entity = new ExampleEntity(event.transaction.from.toHex())
//   // Entity fields can be set using simple assignments
//   entity.count = BigInt.fromI32(0)
// }
// BigInt and BigDecimal math are supported
// entity.count = entity.count + BigInt.fromI32(1)
// Entity fields can be set based on event parameters
// entity.beneficiary = event.params.beneficiary
// entity.amount = event.params.amount
// Entities can be written to the store with `.save()`
// entity.save()
// Note: If a handler doesn't require existing field values, it is faster
// _not_ to load the entity from the store. Instead, create it fresh with
// `new Entity(...)`, set the fields that should be updated and save the
// entity back to the store. Fields that were not set or unset remain
// unchanged, allowing for partial updates to be applied.
// It is also possible to access smart contracts from mappings. For
// example, the contract that has emitted the event can be connected to
// with:
//
// let contract = Contract.bind(event.address)
//
// The following functions can then be called on this contract to access
// state variables and other data:
//
// - contract.secretSigner(...)
// - contract.jackpotSize(...)
// - contract.croupier(...)
// - contract.owner(...)
// - contract.maxProfit(...)
// - contract.lockedInBets(...)


export function handlePlaceBet(call: PlaceBetCall): void {
    let id = call.inputs.commit.toHex();

    let entity = new Bet(id);
    entity.commit = call.inputs.commit;
    entity.gambler = call.from;
    entity.amount = call.transaction.value;
    entity.save();

    let dayData = getDayDataEntity(call.block);
    dayData.betCount = dayData.betCount.plus(BIGINT_ONE);
    dayData.betVolume = dayData.betVolume.plus(call.transaction.value);
    dayData.save();
}

export function handleJackpotPayment(event: JackpotPayment): void {
    let id = crypto.keccak256(ByteArray.fromUTF8(event.transaction.hash.toHex()+"."+event.transactionLogIndex.toHex())).toHex();

    let entity = new Jackpot(id);
    entity.betCommit = BIGINT_ZERO;
    entity.gambler = event.params.beneficiary;
    entity.amount = event.params.amount;
    entity.save();

    let dayData = getDayDataEntity(event.block);
    dayData.jackpotCount = dayData.jackpotCount.plus(BIGINT_ONE);
    dayData.jackpotWinVolume = dayData.jackpotWinVolume.plus(event.params.amount);
    dayData.save();
}

export function handlePayment(event: Payment): void {
    let dayData = getDayDataEntity(event.block);
    let amount = event.params.amount;
    if(!amount.isZero()) {
        dayData.winCount = dayData.winVolume.plus(BIGINT_ONE);
        dayData.winVolume = dayData.winVolume.plus(amount);
        dayData.save();
    }
}
export function handleFailedPayment(event: FailedPayment): void {
    // @TODO: find-out how to handle jackpot win in case payment failed
    // let amount = event.params.amount;
    // if(!amount.equals(BIGINT_ONE)) {
    //     let dayData = getDayDataEntity(event.block);
    //     dayData.winVolume = dayData.winVolume.plus(amount);
    //     dayData.save();
    // }
}

export function handleCommit(event: Commit): void {}

// @TODO: find-out how to get bet result
export function handleRefundBet(call: RefundBetCall): void {}
export function handleSettleBet(call: SettleBetCall): void {}
export function handleSettleBetUncleMerkleProof(call: SettleBetUncleMerkleProofCall): void {}


function concat(a: ByteArray, b: ByteArray): ByteArray {
    let out = new Uint8Array(a.length + b.length)
    for (let i = 0; i < a.length; i++) {
      out[i] = a[i]
    }
    for (let j = 0; j < b.length; j++) {
      out[a.length + j] = b[j]
    }
    return out as ByteArray
}

function getDayDataEntity(block: ethereum.Block):DayData {
    let timestamp = block.timestamp.toI32();
    let dayID = timestamp / 86400;
    let dayIDStr = dayID.toString();        

    let entity = DayData.load(dayIDStr);
    if (entity == null) {
        entity = new DayData(dayIDStr);
        entity.betCount = BIGINT_ZERO;
        entity.betVolume = BIGINT_ZERO;
        entity.winCount= BIGINT_ZERO;
        entity.winVolume = BIGINT_ZERO;
        entity.jackpotCount = BIGINT_ZERO;
        entity.jackpotWinVolume = BIGINT_ZERO;
    }
    return <DayData>entity;
}

