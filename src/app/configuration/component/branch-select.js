import React from 'react';
import PropTypes from 'prop-types';
import Select from '@jetbrains/ring-ui/components/select/select';
import {MinWidth} from '@jetbrains/ring-ui/components/popup/position';
import {i18n} from 'hub-dashboard-addons/dist/localization';

function toKey(buildTypeId, branch) {
  const id = (branch && (branch.internalName || branch.name)) || '<default>';
  return `${buildTypeId}::${id}`;
}

function toLabel(branch) {
  if (!branch) {
    return i18n('Default');
  }
  if (branch.default) {
    return `${branch.name} (${i18n('default')})`;
  }
  return branch.name || i18n('Default');
}

function pair2Item(pair) {
  if (!pair) return null;
  const {buildType, branch} = pair;
  return {
    key: toKey(buildType.id, branch),
    label: `${buildType.path || buildType.name} — ${toLabel(branch)}`,
    payload: pair
  };
}

const BranchSelect = ({
  isLoading,
  isDisabled,
  selectedBranches,
  selectedBuildTypes,
  branchesByBuildType,
  loadError,
  onBranchSelect,
  onBranchDeselect,
  onOpen
}) => {
  const data = (selectedBuildTypes || []).flatMap(bt => {
    const branches = (branchesByBuildType && branchesByBuildType[bt.id]) || [];
    return branches.map(branch => pair2Item({buildType: bt, branch}));
  }).filter(Boolean);

  return (
    <Select
      selectedLabel={i18n('Branches')}
      label={i18n('Branches')}
      multiple={true}
      loading={isLoading}
      disabled={isDisabled}
      selected={(selectedBranches || []).map(pair2Item).filter(Boolean)}
      size={Select.Size.FULL}
      minWidth={MinWidth.TARGET}
      data={data}
      notFoundMessage={loadError}
      onSelect={onBranchSelect}
      onDeselect={onBranchDeselect}
      onOpen={onOpen}
    />
  );
};

BranchSelect.propTypes = {
  isLoading: PropTypes.bool,
  isDisabled: PropTypes.bool,

  selectedBranches: PropTypes.arrayOf(PropTypes.shape({
    buildType: PropTypes.object.isRequired,
    branch: PropTypes.object
  })),

  selectedBuildTypes: PropTypes.arrayOf(PropTypes.object),
  branchesByBuildType: PropTypes.object,

  loadError: PropTypes.string,

  onBranchSelect: PropTypes.func.isRequired,
  onBranchDeselect: PropTypes.func.isRequired,
  onOpen: PropTypes.func.isRequired
};

export default BranchSelect;
