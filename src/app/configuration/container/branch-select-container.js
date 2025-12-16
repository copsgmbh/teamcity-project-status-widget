import {connect} from 'react-redux';

import BranchSelect from '../component/branch-select';
import {loadBranches, selectBranch, deselectBranch} from '../../redux/actions';

const BranchSelectContainer = connect(
  state => {
    const selectedBuildTypes = state.configuration.selectedBuildTypes || [];
    const isDisabled = selectedBuildTypes.length === 0;

    return {
      isLoading: state.configuration.isLoadingBranches,
      isDisabled,
      selectedBuildTypes,
      branchesByBuildType: state.configuration.branchesByBuildType,
      selectedBranches: state.configuration.selectedBranches,
      loadError: state.configuration.branchLoadErrorMessage
    };
  },
  dispatch => ({
    onBranchSelect: ({payload}) => dispatch(selectBranch(payload)),
    onBranchDeselect: ({payload}) => dispatch(deselectBranch(payload)),
    onOpen: () => dispatch(loadBranches())
  })
)(BranchSelect);

BranchSelectContainer.propTypes = {};

export default BranchSelectContainer;
