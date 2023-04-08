import { TransformationError } from './lib/timeline';

export enum CellState {
    Empty = ' ',
    X = 'X',
    O = 'O'
}

interface BoardState {
    board: CellState[];
    moveIndex: number;
    moveCharacter: CellState;
}

export const transformations = {
    move: (board: BoardState, index: number, character: CellState.X | CellState.O): BoardState => {
        if (board.moveCharacter === character)
            throw new TransformationError(`${character} doing 2 moves in a row`);

        if (board.board[index] !== CellState.Empty)
            throw new TransformationError(`Index ${index} is already occupied`);

        board.board[index] = character;
        board.moveIndex = index;
        board.moveCharacter = character;

        return board;
    }
};
