import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Player from './models/Player.js';

dotenv.config();

const runTest = async () => {
    try {
        console.log('⏳ Connecting to MongoDB...');
        if (!process.env.MONGO_URI) {
            throw new Error('MONGO_URI is not defined in .env file');
        }
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected!');

        const testName = "TestUser_1";

        // Cleanup first just in case it exists from a failed run
        await Player.deleteOne({ name: testName });

        console.log(`\n📝 Creating test player: ${testName}...`);
        const newPlayer = await Player.create({ name: testName, score: 999 });
        console.log('✅ Player created:', newPlayer);

        // 2. Verify user exists
        console.log('\n🔍 Verifying player exists in DB...');
        const foundPlayer = await Player.findOne({ name: testName });
        if (foundPlayer) {
            console.log(`✅ Found player: ${foundPlayer.name} with score ${foundPlayer.score}`);
        } else {
            throw new Error('❌ Player was not found after creation!');
        }

        // 3. Delete the user
        console.log('\n🗑️  Cleaning up (deleting test player)...');
        const result = await Player.deleteOne({ name: testName });

        if (result.deletedCount === 1) {
            console.log('✅ Test player deleted.');
        } else {
            console.log('⚠️  Warning: Player was not deleted.');
        }

        console.log('\n🎉 Database test passed successfully!');

    } catch (error) {
        console.error('\n❌ Test Failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('👋 Disconnected.');
        process.exit();
    }
};

runTest();