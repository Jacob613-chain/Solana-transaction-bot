require('dotenv').config();
const { Connection, PublicKey, SystemProgram } = require('@solana/web3.js');
const fs = require('fs');
const HeliusRPCUrl = `https://rpc.helius.xyz/?api-key=${process.env.YOUR_API_KEY}`;

const getTransactionHistory = async (address) => {
    const connection = new Connection(HeliusRPCUrl, 'confirmed');
    const publicKey = new PublicKey(address);

    try {
        let allSignatures = [];
        let lastSignature = null;

        // Fetch all signatures until no more are available
        while (true) {
            const signatures = await connection.getSignaturesForAddress(publicKey, {
                limit: 1000, 
                before: lastSignature,
            });

            if (signatures.length === 0) break;

            allSignatures = allSignatures.concat(signatures);
            lastSignature = signatures[signatures.length - 1].signature; 
        }

        console.log(`Total signatures fetched: ${allSignatures.length}`);

        const transactions = await Promise.all(
            allSignatures.map(async (signatureInfo) => {
                let transaction = null;
                let retries = 5;

                while (retries > 0) {
                    try {
                        transaction = await connection.getParsedTransaction(signatureInfo.signature, { maxSupportedTransactionVersion: 0 });
                        break;
                    } catch (error) {
                        if (error.message.includes('failed to get transaction') || error.message.includes('429')) {
                            console.error(`Error fetching transaction: ${signatureInfo.signature}, retrying...`, error);
                            await new Promise(resolve => setTimeout(resolve, 10000));
                            retries--;
                        } else {
                            throw error; 
                        }
                    }
                }

                if (!transaction || transaction.meta.err) return null; 

                return {
                    signature: signatureInfo.signature,
                    slot: transaction.slot,
                    blockTime: transaction.blockTime,
                    instructions: transaction.transaction.message.instructions,
                };
            })
        );

        const validTransactions = transactions.filter(tx => tx !== null);

        console.log(`Total successful transactions fetched: ${validTransactions.length}`);

        const csvHeader = 'Signature,Block Time,Action,From,To,Value\n';
        const csvRows = validTransactions.map(tx => {
            const blockTimeFormatted = tx.blockTime 
                ? new Date(tx.blockTime * 1000).toISOString() 
                : 'N/A';

            let action = 'Unknown';
            let from = 'N/A';
            let to = 'N/A';
            let value = '0';

            tx.instructions.forEach(instruction => {
                const programId = instruction.programId.toString();

                if (programId === SystemProgram.programId.toString()) {
                   
                    if (instruction.parsed && instruction.parsed.info) {
                        action = 'Transfer';
                        if (instruction.parsed.info.source === address || instruction.parsed.info.destination === address) {
                            from = instruction.parsed.info.source;
                            to = instruction.parsed.info.destination;
                            value = instruction.parsed.info.lamports / 1e9; // Convert lamports to SOL
                        }
                    }
                }
            });

            return `${tx.signature},${blockTimeFormatted},${action},${from},${to},${value}`;
        });

        const csvData = csvHeader + csvRows.join('\n');

        const fileName = `successful_transaction_history_${address}.csv`;
        fs.writeFileSync(fileName, csvData);
        console.log(`Successful transaction history saved to ${fileName}`);

    } catch (error) {
        console.error("Error fetching transaction history:", error);
    }
};

const walletAddress = 'CEUm6PbAbpkcMF8UtZoJGNqvXgDTVbZAVijDGuaNUikC'; 
getTransactionHistory(walletAddress);

/*
// ... existing code ...

const getTransactionHistory = async (address) => {
    const connection = new Connection(HeliusRPCUrl, 'confirmed');
    const publicKey = new PublicKey(address);

    try {
        let allSignatures = [];
        let lastSignature = null;

        while (true) {
            const signatures = await connection.getSignaturesForAddress(publicKey, {
                limit: 1000,
                before: lastSignature,
            });

            if (signatures.length === 0) break;

            allSignatures = allSignatures.concat(signatures);
            lastSignature = signatures[signatures.length - 1].signature;
        }

        console.log(`Total signatures fetched: ${allSignatures.length}`);

        const transactions = await Promise.all(
            allSignatures.map(async (signatureInfo) => {
                let transaction = null;
                let retries = 5;

                while (retries > 0) {
                    try {
                        transaction = await connection.getParsedTransaction(signatureInfo.signature, { maxSupportedTransactionVersion: 0 });
                        break;
                    } catch (error) {
                        if (error.message.includes('failed to get transaction') || error.message.includes('429')) {
                            console.error(`Error fetching transaction: ${signatureInfo.signature}, retrying...`, error);
                            await new Promise(resolve => setTimeout(resolve, 10000));
                            retries--;
                        } else {
                            throw error; 
                        }
                    }
                }

                if (!transaction || transaction.meta.err) return null;

                return {
                    signature: signatureInfo.signature,
                    slot: transaction.slot,
                    blockTime: transaction.blockTime,
                    instructions: transaction.transaction.message.instructions,
                };
            })
        );

        const validTransactions = transactions.filter(tx => tx !== null);

        console.log(`Total successful transactions fetched: ${validTransactions.length}`);

        const csvHeader = 'Signature,Block Time,Action,From,To,Value\n';
        const csvRows = validTransactions.map(tx => {
            const blockTimeFormatted = tx.blockTime 
                ? new Date(tx.blockTime * 1000).toISOString() 
                : 'N/A';

            let action = 'Unknown';
            let from = 'N/A';
            let to = 'N/A';
            let value = '0';

            tx.instructions.forEach(instruction => {
                const programId = instruction.programId.toString();

                if (programId === SystemProgram.programId.toString()) {
                    if (instruction.parsed && instruction.parsed.info) {
                        if (instruction.parsed.info.source === address || instruction.parsed.info.destination === address) {
                            action = 'Transfer';
                            from = instruction.parsed.info.source;
                            to = instruction.parsed.info.destination;
                            value = instruction.parsed.info.lamports / 1e9; 
                        }
                    }
                }
            });

            if (from === address || to === address) {
                return `${tx.signature},${blockTimeFormatted},${action},${from},${to},${value}`;
            }
            return null; 
        }).filter(row => row !== null);

        const csvData = csvHeader + csvRows.join('\n');

        const fileName = `successful_transaction_history_${address}.csv`;
        fs.writeFileSync(fileName, csvData);
        console.log(`Successful transaction history saved to ${fileName}`);

    } catch (error) {
        console.error("Error fetching transaction history:", error);
    }
};

const walletAddress = '4dxoPH5tyb8tuJsWKBS2e739BC9v73efdUExqAbifobx'; 
getTransactionHistory(walletAddress);
*/