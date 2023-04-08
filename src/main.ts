import './styles/styles.css';
import './styles/game.css';
import './styles/popup.css';

import { BoardDisplay, Player } from './board-display';
import { Timeline } from './lib/timeline';
import { CellState, transformations } from './transformations';

const popup = document.getElementById('popup')!;
const popupTextDispaly = document.getElementById('popupText')!;

document.getElementById('viewBoard')!.onclick = () => {
    popup.style.display = 'none';
};

document.getElementById('playAgain')!.onclick = async () => {
    popup.style.display = 'none';
    await newGame();
};

async function newGame() {
    const main = document.getElementById('main')!;

    if (main.firstChild !== null)
        main.removeChild(main.firstChild);

    const timeline = new Timeline(transformations, () => ({
        board: [CellState.Empty, CellState.Empty, CellState.Empty, CellState.Empty, CellState.Empty, CellState.Empty, CellState.Empty, CellState.Empty, CellState.Empty],
        moveIndex: 0,
        moveCharacter: CellState.Empty
    }));

    const display = new BoardDisplay(main, timeline, (player) => {
        function checkWinCondition(cache: CellState[][], player: Player): number {
            return cache.filter((board) => {
                if (
                    (board[0] === player && board[1] === player && board[2] === player) ||
                    (board[3] === player && board[4] === player && board[5] === player) ||
                    (board[6] === player && board[7] === player && board[8] === player) ||
                    (board[0] === player && board[3] === player && board[6] === player) ||
                    (board[1] === player && board[4] === player && board[7] === player) ||
                    (board[2] === player && board[5] === player && board[8] === player) ||
                    (board[0] === player && board[4] === player && board[8] === player) ||
                    (board[2] === player && board[4] === player && board[6] === player)
                )
                    return true;

                return false;
            }).length;
        }

        const cache = [...timeline.getCache().values()].filter((board) => board.moveCharacter !== CellState.Empty).map((board) => board.board);

        const xWins = checkWinCondition(cache, CellState.X);
        const oWins = checkWinCondition(cache, CellState.O);

        if (xWins > 0 || oWins > 0) {
            if (xWins > 0 && oWins === 0) {
                popupTextDispaly.textContent = `Congratulations! X won on ${xWins} boards!`;
                display.gameOver(CellState.X);
            } else if (oWins > 0 && xWins === 0) {
                popupTextDispaly.textContent = `Congratulations! O won on ${oWins} boards!`;
                display.gameOver(CellState.O);
            } else if (xWins > 0 && oWins > 0) {
                popupTextDispaly.textContent = `Tie! X won on ${xWins} boards and O won on ${oWins} boards!`;
                display.gameOver(CellState.Empty);
            }

            popup.style.display = 'block';
        }
    });

    queueMicrotask(() => {
        display.setSize(main.clientWidth, main.clientHeight);
    });

    window.onresize = () => {
        display.setSize(main.clientWidth, main.clientHeight);
    };
}

(async () => {
    document.getElementById('restart')!.onclick = async () => {
        await newGame();
    };

    await newGame();
})();
