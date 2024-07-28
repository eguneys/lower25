import CPlayer from './audio-player'
import { song1 } from './songs'


export default function() {

    let ctx = new AudioContext(),
        audioMaster = ctx.createGain();

    audioMaster.connect(ctx.destination);

    const sounds: Record<string, AudioBuffer> = {};

    const addSound = (name: string, buffer: AudioBuffer) => {
        sounds[name] = buffer;
    };

    const data = [
        { name: 'song', data: song1 },
    ];

    const generate = () => {

        data.forEach(o => {
            let generator = new CPlayer();
            generator.init(o.data);
            function step() {
                if (generator.generate() === 1) {
                    let buffer = generator.createAudioBuffer(ctx)
                    addSound(o.name, buffer);
                } else {
                    setTimeout(step, 0);
                }
            }
            step();
        });

        return new Promise<void>(resolve => {
            function check() {
                if (Object.keys(sounds).length === data.length) {
                    resolve();
                    return;
                }
                setTimeout(check, 100);
            }
            check();
        });
    };



    const playSound = (name: string, loop = false) => {
        const buffer = sounds[name];

        if (!buffer) {
            return null;
        }

        let source = ctx.createBufferSource(),
            gainNode = ctx.createGain(),
            panNode = ctx.createStereoPanner();

        source.buffer = buffer;
        source.connect(panNode);
        panNode.connect(gainNode);
        gainNode.connect(audioMaster);

        source.loop = loop;
        gainNode.gain.value = 0.8;
        source.start();
        return {
            volume: gainNode,
            sound: source
        };
    };

    return { generate, play: playSound }
}